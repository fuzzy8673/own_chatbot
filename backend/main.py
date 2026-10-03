import os
from fastapi.responses import StreamingResponse   #lets FastAPI send pieces of a response as they're generated.
import json   #lets us encode each piece as a structured event that React can read reliably.
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq


# --------------------------------------------------
# Load environment variables from .env
# --------------------------------------------------

load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY")

if not groq_api_key:
    raise RuntimeError("GROQ_API_KEY is not set in the .env file")


# --------------------------------------------------
# Create Groq client
# --------------------------------------------------

client = Groq(api_key=groq_api_key)


# --------------------------------------------------
# Create FastAPI application
# --------------------------------------------------

app = FastAPI()


# --------------------------------------------------
# CORS configuration
# Allows our React frontend to communicate
# with the FastAPI backend.
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# Request model
# --------------------------------------------------


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


# --------------------------------------------------
# Home endpoint
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "AI Chatbot Backend is running!"
    }


# --------------------------------------------------
# Chat endpoint
# --------------------------------------------------

@app.post("/chat")
def chat(request: ChatRequest):

    # Build the conversation with a system instruction.
    conversation = [
        {
            "role": "system",
            "content": (
                "You are a helpful AI assistant. "
                "Give clear, accurate and concise answers. "
                "Use Markdown when it improves readability."
            )
        }
    ]

    # Add previous user and assistant messages.
    conversation.extend(
        [
            {
                "role": message.role,
                "content": message.content
            }
            for message in request.messages
        ]
    )

    def generate_response():
        try:
            # Ask Groq to stream the response.
            stream = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=conversation,
                stream=True
            )

            # Send each generated text chunk to the browser.
            for chunk in stream:
                content = chunk.choices[0].delta.content

                if content:
                    event = json.dumps({"token": content})
                    yield f"data: {event}\n\n"

            # Tell the frontend the response is complete.
            yield 'data: {"done": true}\n\n'

        except Exception as e:
            print("Groq streaming error:", str(e))

            # Streaming has already started, so report errors
            # as events rather than trying to change HTTP status.
            event = json.dumps({
                "error": "The AI response was interrupted. Please try again."
            })
            yield f"data: {event}\n\n"

    return StreamingResponse(
        generate_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


    