import json
import requests

url = "http://127.0.0.1:8000/chat"

payload = {
    "messages": [
        {
            "role": "user",
            "content": "Explain neha in three poetic sentences."
        }
    ]
}

with requests.post(
    url,
    json=payload,
    stream=True,
    timeout=120
) as response:

    response.raise_for_status()

    print("Streaming response:\n")

    for line in response.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data: "):
            continue

        event = json.loads(line[6:])

        if "token" in event:
            print(event["token"], end="", flush=True)

        elif event.get("done"):
            print("\n\nStream completed.")
            break

        elif "error" in event:
            print("\nStream error:", event["error"])
            break