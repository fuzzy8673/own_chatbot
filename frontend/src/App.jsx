import { useEffect, useRef, useState } from "react";

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  const sendMessage = async () => {
    const userMessage = input.trim();

    // Don't send empty messages
    if (!userMessage || loading) {
      return;
    }

    // Immediately display the user's message
    setMessages((previousMessages) => [
      ...previousMessages,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    // Clear input box
    setInput("");

    // Show loading state
    setLoading(true);

    try {
      const result = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          message: userMessage,
        }),
      });

      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.detail || "Something went wrong");
      }

      // Add AI response to conversation
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          content: data.response,
        },
      ]);
    } catch (error) {
      // Display error as an assistant message
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "error",
          content: error.message,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    // Enter sends the message
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
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
            className={`flex mb-4 ${
              msg.role === "user"
                ? "justify-end"
                : "justify-start"
            }`}
          >

            <div
              className={`max-w-xl rounded-lg px-4 py-3 ${
                msg.role === "user"
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

              <div className="whitespace-pre-wrap">
                {msg.content}
              </div>

            </div>

          </div>

        ))}


        {/* Loading indicator */}
        {loading && (
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
            onClick={sendMessage}
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