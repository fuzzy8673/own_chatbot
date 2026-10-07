import os
from fastapi.responses import StreamingResponse   #lets FastAPI send pieces of a response as they're generated.
import json   #lets us encode each piece as a structured event that React can read reliably.
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from database import get_connection, init_db
from database import get_connection, init_db, create_conversation


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

# Initialize SQLite database when the backend starts.
init_db()


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
    conversation_id: int | None = None


# --------------------------------------------------
# Home endpoint
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "AI Chatbot Backend is running!"
    }





# test db endpoint
@app.get("/db-test")
def database_test():
    with get_connection() as connection:
        result = connection.execute(
            "SELECT COUNT(*) AS count FROM conversations"
        ).fetchone()

    return {
        "database": "connected",
        "conversation_count": result["count"]
    }
# --------------------------------------------------
# Chat endpoint
# --------------------------------------------------

# @app.post("/chat")
# def chat(request: ChatRequest):

#     # Create a new conversation if this is the first message.
#     conversation_id = request.conversation_id

#     if conversation_id is None:
#         conversation_id = create_conversation()

#         # Get the latest user message.
#     latest_user_message = next(
#         (
#             message
#             for message in reversed(request.messages)
#             if message.role == "user"
#         ),
#         None
#     )

#     if latest_user_message:
#         with get_connection() as connection:
#             connection.execute(
#                 """
#                 INSERT INTO messages
#                     (conversation_id, role, content)
#                 VALUES (?, ?, ?)
#                 """,
#                 (
#                     conversation_id,
#                     latest_user_message.role,
#                     latest_user_message.content
#                 )
#             )

#     # Build the conversation with a system instruction.
#     conversation = [
#         {
#             "role": "system",
#             "content": (
#                 "You are a helpful AI assistant. "
#                 "Give clear, accurate and concise answers. "
#                 "Use Markdown when it improves readability."
#             )
#         }
#     ]

#     # Add previous user and assistant messages.
#     conversation.extend(
#         [
#             {
#                 "role": message.role,
#                 "content": message.content
#             }
#             for message in request.messages
#         ]
#     )

#     # def generate_response():
#     #     try:
#     #         # Ask Groq to stream the response.
#     #         stream = client.chat.completions.create(
#     #             model="openai/gpt-oss-120b",
#     #             messages=conversation,
#     #             stream=True
#     #         )

#     #         # Send each generated text chunk to the browser.
#     #         for chunk in stream:
#     #             content = chunk.choices[0].delta.content

#     #             if content:
#     #                 event = json.dumps({"token": content})
#     #                 yield f"data: {event}\n\n"

#     #         # Tell the frontend the response is complete.
#     #         yield 'data: {"done": true}\n\n'

#     #     except Exception as e:
#     #         print("Groq streaming error:", str(e))

#     #         # Streaming has already started, so report errors
#     #         # as events rather than trying to change HTTP status.
#     #         event = json.dumps({
#     #             "error": "The AI response was interrupted. Please try again."
#     #         })
#     #         yield f"data: {event}\n\n"

#     def generate_response():
#         try:
#             stream = client.chat.completions.create(
#                 model="openai/gpt-oss-120b",
#                 messages=conversation,
#                 stream=True
#             )

#             # Store the complete AI response while
#             # simultaneously streaming it to the frontend.
#             full_response = ""

#             for chunk in stream:
#                 content = chunk.choices[0].delta.content

#                 if content:
#                     full_response += content

#                     # Send this piece to the frontend immediately.
#                     event = json.dumps({"token": content})
#                     yield f"data: {event}\n\n"

#             # Only save the assistant response after
#             # the entire stream has completed successfully.
#             if full_response:
#                 with get_connection() as connection:
#                     connection.execute(
#                         """
#                         INSERT INTO messages
#                             (conversation_id, role, content)
#                         VALUES (?, ?, ?)
#                         """,
#                         (
#                             conversation_id,
#                             "assistant",
#                             full_response
#                         )
#                     )

#                     # Update the conversation timestamp.
#                     connection.execute(
#                         """
#                         UPDATE conversations
#                         SET updated_at = CURRENT_TIMESTAMP
#                         WHERE id = ?
#                         """,
#                         (conversation_id,)
#                     )

#             # Tell the frontend that generation is complete.
#             yield 'data: {"done": true}\n\n'

#         except Exception as e:
#             print("Groq streaming error:", str(e))

#             event = json.dumps({
#                 "error": "The AI response was interrupted. Please try again."
#             })

#             yield f"data: {event}\n\n"
#         return StreamingResponse(
#             generate_response(),
#             media_type="text/event-stream",
#             headers={
#                 "Cache-Control": "no-cache",
#                 "X-Accel-Buffering": "no"
#             }
#         )


@app.post("/chat")
def chat(request: ChatRequest):

    # ---------------------------------------------------------
    # 1. Create a conversation if this is the first message.
    # ---------------------------------------------------------

    conversation_id = request.conversation_id

    if conversation_id is None:
        conversation_id = create_conversation()

    # ---------------------------------------------------------
    # 2. Get the latest user message.
    # ---------------------------------------------------------

    latest_user_message = next(
        (
            message
            for message in reversed(request.messages)
            if message.role == "user"
        ),
        None
    )

    # ---------------------------------------------------------
    # 3. Save the user message to SQLite.
    # ---------------------------------------------------------

    if latest_user_message:
        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO messages
                    (conversation_id, role, content)
                VALUES (?, ?, ?)
                """,
                (
                    conversation_id,
                    latest_user_message.role,
                    latest_user_message.content
                )
            )

    # ---------------------------------------------------------
    # 4. Build the conversation for Groq.
    # ---------------------------------------------------------

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

    conversation.extend(
        [
            {
                "role": message.role,
                "content": message.content
            }
            for message in request.messages
        ]
    )

    # ---------------------------------------------------------
    # 5. Generate and stream the AI response.
    # ---------------------------------------------------------

    def generate_response():

        try:

            stream = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=conversation,
                stream=True
            )

            # Send the conversation ID to the frontend.
            yield f'data: {json.dumps({"conversation_id": conversation_id})}\n\n'

            # Keep the complete response in memory.
            full_response = ""

            for chunk in stream:

                content = chunk.choices[0].delta.content

                if content:

                    # Add token to complete response.
                    full_response += content

                    # Immediately send token to frontend.
                    event = json.dumps({
                        "token": content
                    })

                    yield f"data: {event}\n\n"

            # -------------------------------------------------
            # 6. Save the assistant response ONLY after
            #    the complete stream finishes successfully.
            # -------------------------------------------------

            if full_response:

                with get_connection() as connection:

                    connection.execute(
                        """
                        INSERT INTO messages
                            (conversation_id, role, content)
                        VALUES (?, ?, ?)
                        """,
                        (
                            conversation_id,
                            "assistant",
                            full_response
                        )
                    )

                    # Update conversation timestamp.
                    connection.execute(
                        """
                        UPDATE conversations
                        SET updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                        """,
                        (conversation_id,)
                    )

            # Tell frontend that streaming is complete.
            yield 'data: {"done": true}\n\n'

        except Exception as e:

            print("Groq streaming error:", str(e))

            event = json.dumps({
                "error": "The AI response was interrupted. Please try again."
            })

            yield f"data: {event}\n\n"

    # ---------------------------------------------------------
    # IMPORTANT:
    # StreamingResponse MUST be returned by chat(),
    # NOT from inside generate_response().
    # ---------------------------------------------------------

    return StreamingResponse(
        generate_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )



    