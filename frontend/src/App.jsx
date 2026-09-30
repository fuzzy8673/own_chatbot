import { useState } from "react";

function App() {

  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);


  // Send message to FastAPI backend
  const sendMessage = async () => {

    // Don't send empty messages
    if (!message.trim()) {
      return;
    }

    setLoading(true);
    setResponse("");

    try {

      const result = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          message: message
        })
      });


      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.detail || "Something went wrong");
      }

      setResponse(data.response);

    } catch (error) {

      setResponse(
        "Error: " + error.message
      );

    } finally {

      setLoading(false);

    }
  };


  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* Header */}
      <header className="bg-gray-900 text-white p-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold">
            🤖 AI Chatbot
          </h1>
        </div>
      </header>


      {/* Chat area */}
      <main className="flex-1 p-6">

        <div className="max-w-3xl mx-auto">

          {/* User message */}
          {message && (
            <div className="bg-blue-600 text-white rounded-lg p-4 mb-4 ml-auto max-w-xl">
              <p className="font-semibold mb-1">
                You
              </p>

              <p>
                {message}
              </p>
            </div>
          )}


          {/* AI response */}
          {response && (
            <div className="bg-white rounded-lg p-4 shadow mb-4 max-w-xl">

              <p className="font-semibold mb-1">
                AI
              </p>

              <p className="whitespace-pre-wrap">
                {response}
              </p>

            </div>
          )}


          {/* Loading */}
          {loading && (
            <div className="bg-white rounded-lg p-4 shadow max-w-xl">
              AI is thinking...
            </div>
          )}

        </div>

      </main>


      {/* Input */}
      <footer className="bg-white border-t p-4">

        <div className="max-w-3xl mx-auto flex gap-3">

          <input
            type="text"
            placeholder="Ask something..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
            className="flex-1 border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? "..." : "Send"}
          </button>

        </div>

      </footer>

    </div>
  );
}

export default App;