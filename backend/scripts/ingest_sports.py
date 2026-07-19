import asyncio
import os
import sys
import httpx

# Add the parent directory to sys.path so we can import 'app'
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

async def ingest_sports_data():
    """Upload sports markdown files to the /api/v1/upload endpoint."""

    datasets_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../datasets"))
    cricket_path = os.path.join(datasets_dir, "cricket.md")
    football_path = os.path.join(datasets_dir, "football.md")

    api_base = "http://127.0.0.1:8000/api/v1"

    async with httpx.AsyncClient(timeout=120.0) as client:
        for name, path in [("Cricket", cricket_path), ("Football", football_path)]:
            print(f"Ingesting {name} from {path}...")
            if not os.path.exists(path):
                print(f"  [ERROR] File not found: {path}")
                continue

            try:
                with open(path, "rb") as f:
                    files = {"file": (f"{name.lower()}.md", f, "text/markdown")}
                    response = await client.post(f"{api_base}/upload/", files=files)

                if response.status_code == 200:
                    data = response.json()
                    print(f"  [OK] {name} upload successful!")
                    print(f"     Document ID: {data.get('id')}")
                    print(f"     Status: {data.get('status')}")
                    print(f"     Pages: {data.get('page_count')}")
                    print(f"     Chunks: {data.get('chunk_count')}")
                    print(f"     Entities: {data.get('entity_count')}")
                else:
                    print(f"  [ERROR] {name} upload failed: HTTP {response.status_code}")
                    print(f"     Response: {response.text}")
            except httpx.ConnectError:
                print(f"  [ERROR] Cannot connect to API at {api_base}")
                print(f"     Make sure the backend is running: uvicorn app.main:app --port 8000")
                break
            except Exception as e:
                print(f"  [ERROR] {name} upload error: {e}")

if __name__ == "__main__":
    asyncio.run(ingest_sports_data())
