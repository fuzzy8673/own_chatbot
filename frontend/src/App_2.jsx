import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingConversationId, setEditingConversationId] = useState(null);
  const [editedTitle, setEditedTitle] = useState("");

  const messagesEndRef = useRef(null);

  // Scroll to the latest message


  // Keep the latest message visible without restarting smooth scrolling
  // for every token received from the AI.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "auto",
      block: "end",
    });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/conversations"
      );

      if (!response.ok) {
        throw new Error("Failed to load conversations");
      }

      const data = await response.json();
      setConversations(data.conversations);
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);


  const loadConversation = async (id) => {
    if (loading) return;

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/conversations/${id}`
      );

      if (!response.ok) {
        throw new Error("Failed to load conversation");
      }

      const data = await response.json();

      setConversationId(data.conversation.id);

      setMessages(
        data.messages.map((message) => ({
          role: message.role,
          content: message.content,
        }))
      );
    } catch (error) {
      console.error(
        "Error loading conversation:",
        error
      );
    }
  };

  const handleSend = async () => {
    const userMessage = input.trim();

    // Do not send empty messages or overlapping requests.
    if (!userMessage || loading) return;

    const newUserMessage = {
      role: "user",
      content: userMessage,
    };

    // Include previous messages so the AI retains conversation context.
    const conversation = [
      ...messages.filter(
        (message) =>
          message.role === "user" ||
          message.role === "assistant"
      ),
      newUserMessage,
    ];

    // Create an empty assistant message that we will update as tokens arrive.
    const assistantIndex = conversation.length;

    setMessages([
      ...conversation,
      { role: "assistant", content: "" },
    ]);

    setInput("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: conversation,
            conversation_id: conversationId,
          }),
        }
      );

      // Handle HTTP errors before reading the stream.
      if (!response.ok) {
        let errorMessage = "Something went wrong.";

        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          // Keep the default message if the response is not JSON.
        }

        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("Streaming is not supported by this response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let streamFinished = false;

      // Read incoming bytes and convert them into text.
      while (!streamFinished) {
        const { value, done } = await reader.read();

        if (done) {
          buffer += decoder.decode();
          streamFinished = true;
        } else {
          buffer += decoder.decode(value, { stream: true });
        }

        // A single network chunk may contain part of an event
        // or several events. Process only complete SSE events.
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const eventText of events) {
          const dataLine = eventText
            .split("\n")
            .find((line) => line.startsWith("data: "));

          if (!dataLine) continue;

          const event = JSON.parse(dataLine.slice(6));

          if (event.conversation_id) {
            setConversationId(event.conversation_id);
            await loadConversations();
          }

          if (event.token) {
            // Append each token to the same assistant message.
            setMessages((previousMessages) =>
              previousMessages.map((message, index) =>
                index === assistantIndex
                  ? {
                    ...message,
                    content: message.content + event.token,
                  }
                  : message
              )
            );
          }

          if (event.error) {
            throw new Error(event.error);
          }

          if (event.done) {
            streamFinished = true;
            break;
          }
        }
      }
    } catch (error) {
      // Show the error in the assistant message.
      setMessages((previousMessages) =>
        previousMessages.map((message, index) =>
          index === assistantIndex
            ? {
              ...message,
              content:
                message.content ||
                `Error: ${error.message}`,
            }
            : message
        )
      );
    } finally {
      setLoading(false);
    }
  };


  const handleKeyDown = (event) => {
    // Enter sends the message
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput("");
  };

  // Rename a saved conversation using the backend PATCH endpoint.
  const handleRenameConversation = async (id) => {
    const title = editedTitle.trim();

    if (!title) {
      alert("Conversation title cannot be empty.");
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/conversations/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to rename conversation.");
      }

      setEditingConversationId(null);
      setEditedTitle("");
      await loadConversations();
    } catch (error) {
      alert(error.message);
    }
  };

  // Confirm before deleting a conversation from the database.
  const handleDeleteConversation = async (id, title) => {
    const confirmed = window.confirm(
      `Delete "${title || `Chat ${id}`}"? This will permanently delete its messages.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/conversations/${id}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to delete conversation.");
      }

      // If the deleted conversation is open, reset the chat view.
      if (id === conversationId) {
        clearChat();
      }

      if (editingConversationId === id) {
        setEditingConversationId(null);
        setEditedTitle("");
      }

      await loadConversations();
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* Header */}
      <header className="bg-gray-900 text-white p-4">
        <div className="w-full flex justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label={sidebarOpen ? "Hide conversation sidebar" : "Show conversation sidebar"}
              className="rounded-lg px-3 py-2 bg-gray-700 hover:bg-gray-600"
            >
              ☰
            </button>
            <h1 className="text-xl font-semibold">
              🤖 AI Chatbot
            </h1>
          </div>

          <button
            onClick={clearChat}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg"
          >
            + New Chat
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Conversation sidebar */}
        {sidebarOpen && (
          <aside className="w-72 shrink-0 bg-gray-900 text-white flex flex-col border-r border-gray-700">
            <div className="p-4">
              <button
                type="button"
                onClick={clearChat}
                className="w-full rounded-lg border border-gray-600 px-3 py-3 text-left hover:bg-gray-800"
              >
                <span className="mr-2">＋</span> New conversation
              </button>
            </div>

            <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Recent conversations
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {conversations.length === 0 ? (
                <p className="px-3 py-4 text-sm text-gray-400">
                  Your conversations will appear here.
                </p>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`rounded-lg px-2 py-2 transition ${
                        conversation.id === conversationId
                          ? "bg-gray-700"
                          : "hover:bg-gray-800"
                      }`}
                    >
                      {editingConversationId === conversation.id ? (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            handleRenameConversation(conversation.id);
                          }}
                          className="space-y-2"
                        >
                          <input
                            autoFocus
                            value={editedTitle}
                            maxLength={100}
                            onChange={(event) => setEditedTitle(event.target.value)}
                            aria-label="Conversation title"
                            className="w-full rounded border border-gray-500 bg-gray-800 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="rounded bg-blue-600 px-2 py-1 text-xs hover:bg-blue-500"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingConversationId(null);
                                setEditedTitle("");
                              }}
                              className="rounded bg-gray-600 px-2 py-1 text-xs hover:bg-gray-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => loadConversation(conversation.id)}
                            disabled={loading}
                            title={conversation.title}
                            className="min-w-0 flex-1 rounded px-1 py-1 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className="block truncate">
                              {conversation.title || `Chat ${conversation.id}`}
                            </span>
                          </button>
                          <button
                            type="button"
                            title="Rename conversation"
                            aria-label={`Rename ${conversation.title || `Chat ${conversation.id}`}`}
                            disabled={loading}
                            onClick={() => {
                              setEditingConversationId(conversation.id);
                              setEditedTitle(conversation.title || "");
                            }}
                            className="shrink-0 rounded px-2 py-1 text-gray-300 hover:bg-gray-600 hover:text-white disabled:opacity-50"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            title="Delete conversation"
                            aria-label={`Delete ${conversation.title || `Chat ${conversation.id}`}`}
                            disabled={loading}
                            onClick={() =>
                              handleDeleteConversation(
                                conversation.id,
                                conversation.title
                              )
                            }
                            className="shrink-0 rounded px-2 py-1 text-gray-300 hover:bg-red-700 hover:text-white disabled:opacity-50"
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-700 p-3 text-xs text-gray-400">
              {conversations.length} saved {conversations.length === 1 ? "conversation" : "conversations"}
            </div>
          </aside>
        )}

        {/* Chat messages */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 pb-32">

        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <h2 className="text-2xl font-semibold mb-2">
              How can I help you?
            </h2>

            <p>
              Ask me anything to get started.
            </p>
          </div>
        )}


        {messages.map((msg, index) => (

          <div
            key={index}
            className={`flex mb-4 ${msg.role === "user"
              ? "justify-end"
              : "justify-start"
              }`}
          >

            <div
              className={`max-w-xl rounded-lg px-4 py-3 ${msg.role === "user"
                ? "bg-blue-600 text-white"
                : msg.role === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-white shadow"
                }`}
            >

              <div className="text-xs font-semibold mb-1 opacity-70">
                {msg.role === "user"
                  ? "You"
                  : msg.role === "error"
                    ? "Error"
                    : "AI"}
              </div>



              <div className="prose prose-sm max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-2xl font-bold mt-4 mb-3">
                        {children}
                      </h1>
                    ),

                    h2: ({ children }) => (
                      <h2 className="text-xl font-bold mt-4 mb-3">
                        {children}
                      </h2>
                    ),

                    h3: ({ children }) => (
                      <h3 className="text-lg font-semibold mt-3 mb-2">
                        {children}
                      </h3>
                    ),

                    p: ({ children }) => (
                      <p className="mb-3 leading-7">
                        {children}
                      </p>
                    ),

                    ul: ({ children }) => (
                      <ul className="list-disc ml-6 mb-3 space-y-1">
                        {children}
                      </ul>
                    ),

                    ol: ({ children }) => (
                      <ol className="list-decimal ml-6 mb-3 space-y-1">
                        {children}
                      </ol>
                    ),

                    li: ({ children }) => (
                      <li>
                        {children}
                      </li>
                    ),

                    strong: ({ children }) => (
                      <strong className="font-semibold">
                        {children}
                      </strong>
                    ),

                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-gray-300 pl-4 italic my-3">
                        {children}
                      </blockquote>
                    ),

                    code: ({ children, className }) => {
                      const isCodeBlock = className?.startsWith("language-");

                      if (!isCodeBlock) {
                        return (
                          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">
                            {children}
                          </code>
                        );
                      }

                      return (
                        <code className={className}>
                          {children}
                        </code>
                      );
                    },

                    pre: ({ children }) => (
                      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto my-4 text-sm">
                        {children}
                      </pre>
                    ),

                    table: ({ children }) => (
                      <div className="overflow-x-auto my-4">
                        <table className="border-collapse border border-gray-300 w-full text-sm">
                          {children}
                        </table>
                      </div>
                    ),

                    th: ({ children }) => (
                      <th className="border border-gray-300 bg-gray-100 px-3 py-2 text-left font-semibold">
                        {children}
                      </th>
                    ),

                    td: ({ children }) => (
                      <td className="border border-gray-300 px-3 py-2">
                        {children}
                      </td>
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>

            </div>

          </div>

        ))}


        {/* Loading indicator */}
        {loading &&
          messages[messages.length - 1]?.role === "assistant" &&
          !messages[messages.length - 1]?.content && (
            <div className="flex justify-start mb-4">

              <div className="bg-white shadow rounded-lg px-4 py-3">

                <div className="text-xs font-semibold mb-1 text-gray-500">
                  AI
                </div>

                <div className="text-gray-500">
                  AI is thinking...
                </div>

              </div>

            </div>
          )}

        {/* Invisible element used for auto-scroll */}
        <div ref={messagesEndRef} />

        </main>
      </div>

      {/* Input area */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">

        <div className="max-w-4xl mx-auto flex gap-3">

          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask something..."
            rows={1}
            disabled={loading}
            className="flex-1 border rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />

          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? "..." : "Send"}
          </button>

        </div>

        <p className="text-xs text-gray-400 max-w-4xl mx-auto mt-2">
          Enter to send • Shift + Enter for a new line
        </p>

      </footer>

    </div>
  );
}

export default App;