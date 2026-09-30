import os

from dotenv import load_dotenv
from fastapi import FastAPI
from openai import OpenAI
from pydantic import BaseModel

# Load environment variables from .env
load_dotenv()

# Create OpenAI client
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

app = FastAPI()


# Request model
class ChatRequest(BaseModel):
    message: str


@app.get("/")
def home():
    return {
        "message": "AI Chatbot Backend is running!"
    }


@app.post("/chat")
def chat(request: ChatRequest):

    response = client.responses.create(
        model="gpt-5-mini",
        input=request.message
    )

    return {
        "response": response.output_text
    }