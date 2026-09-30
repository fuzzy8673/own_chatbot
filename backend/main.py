import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import errors

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
        "message": "AI Chatbot Backend is running!"
    }


# Chat endpoint
@app.post("/chat")
def chat(request: ChatRequest):

    try:
        # Send user's message to Gemini
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=request.message
        )

        return {
            "response": response.text
        }

    except errors.ServerError as e:
        # Gemini server-side problem, such as 503
        raise HTTPException(
            status_code=503,
            detail="Gemini is temporarily unavailable. Please try again."
        )

    except errors.ClientError as e:
        # API key, model, request, quota, etc.
        raise HTTPException(
            status_code=400,
            detail=f"Gemini API request failed: {str(e)}"
        )

    except Exception as e:
        # Unexpected error
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected server error: {str(e)}"
        )