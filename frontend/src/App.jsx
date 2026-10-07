import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);

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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* Header */}
      <header className="bg-gray-900 text-white p-4">
        <div className="max-w-3xl mx-auto flex justify-between items-center">

          <h1 className="text-xl font-semibold">
            🤖 AI Chatbot
          </h1>

          <button
            onClick={clearChat}
            disabled={messages.length === 0}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 px-4 py-2 rounded-lg"
          >
            New Chat
          </button>

        </div>
      </header>


      {/* Chat messages */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-6 pb-32">

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


      {/* Input area */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">

        <div className="max-w-3xl mx-auto flex gap-3">

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

        <p className="text-xs text-gray-400 max-w-3xl mx-auto mt-2">
          Enter to send • Shift + Enter for a new line
        </p>

      </footer>

    </div>
  );
}

export default App;