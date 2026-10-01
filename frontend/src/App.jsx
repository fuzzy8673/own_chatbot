import { useState } from "react";

function App() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim()) {
      return;
    }

    setLoading(true);
    setResponse("");

    try {
      const result = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          message: message,
        }),
      });

      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.detail || "Something went wrong");
      }

      setResponse(data.response);
    } catch (error) {
      setResponse("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Header */}
      <header className="bg-gray-900 text-white p-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold">
            🤖 AI Chatbot
          </h1>
        </div>
      </header>

      {/* Chat area */}
      <main className="max-w-3xl mx-auto p-6">

        {/* User message */}
        {message && (
          <div className="flex justify-end mb-4">
            <div className="bg-blue-600 text-white rounded-lg px-4 py-3 max-w-xl">
              {message}
            </div>
          </div>
        )}

        {/* AI response */}
        {response && (
          <div className="flex justify-start mb-4">
            <div className="bg-white shadow rounded-lg px-4 py-3 max-w-xl">
              <p className="whitespace-pre-wrap">
                {response}
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white shadow rounded-lg px-4 py-3 max-w-xl">
            AI is thinking...
          </div>
        )}

      </main>

      {/* Input area */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">

        <div className="max-w-3xl mx-auto flex gap-3">

          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
            placeholder="Ask something..."
            className="flex-1 border rounded-lg px-4 py-3"
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg disabled:bg-gray-400"
          >
            {loading ? "..." : "Send"}
          </button>

        </div>

      </div>

    </div>
  );
}

export default App;