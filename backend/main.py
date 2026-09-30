import os

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from google import genai

# Load variables from .env
load_dotenv()

# Get Gemini API key
api_key = os.getenv("GEMINI_API_KEY")

# Create Gemini client
client = genai.Client(api_key=api_key)

# Create FastAPI application
app = FastAPI()


# Request structure
class ChatRequest(BaseModel):
    message: str


# Test endpoint
@app.get("/")
def home():
    return {
        "message": "AI Chatbot Backend is running with gemini key!"
    }


# Chat endpoint
@app.post("/chat")
def chat(request: ChatRequest):

    # Send user's message to Gemini
    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=request.message
    )

    # Return Gemini's response
    return {
        "response": response.text
    }