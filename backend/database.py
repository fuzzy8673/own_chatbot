
import sqlite3
from pathlib import Path

# Store the database alongside this Python file.
DB_PATH = Path(__file__).resolve().parent / "chatbot.db"


def get_connection():
    """Create a connection to the SQLite database."""
    connection = sqlite3.connect(DB_PATH)

    # Enforce foreign-key relationships in SQLite.
    connection.execute("PRAGMA foreign_keys = ON")

    # Allow columns to be accessed by name as well as index.
    connection.row_factory = sqlite3.Row

    return connection


def init_db():
    """Create the required tables if they do not exist."""

    with get_connection() as connection:
        # One row represents one conversation.
        connection.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL DEFAULT 'New Chat',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Each conversation can contain multiple messages.
        connection.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                role TEXT NOT NULL
                    CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (conversation_id)
                    REFERENCES conversations(id)
                    ON DELETE CASCADE
            )
        """)

        # Speed up retrieval of messages for a conversation.
        connection.execute("""
            CREATE INDEX IF NOT EXISTS
            idx_messages_conversation_id
            ON messages(conversation_id)
        """)

    print(f"Database initialized at: {DB_PATH}")



def create_conversation(title="New Chat"):
    """Create a new conversation and return its ID."""

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO conversations (title)
            VALUES (?)
            """,
            (title,)
        )

        return cursor.lastrowid
