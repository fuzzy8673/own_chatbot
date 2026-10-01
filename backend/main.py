import os

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

class ChatRequest(BaseModel):
    message: str


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

    try:

        # Send the user's message to Groq
        response = client.chat.completions.create(

            # We'll use this model initially.
            # model="llama-3.3-70b-versatile",
            model="openai/gpt-oss-120b",

            # Chat messages
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful AI assistant. "
                        "Give clear, accurate and concise answers."
                    )
                },
                {
                    "role": "user",
                    "content": request.message
                }
            ]
        )

        # Extract the generated text
        answer = response.choices[0].message.content

        return {
            "response": answer
        }

    except Exception as e:

        print("Groq API error:", str(e))

        raise HTTPException(
            status_code=500,
            detail=f"Groq API request failed: {str(e)}"
        )