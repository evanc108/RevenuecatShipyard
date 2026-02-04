#!/usr/bin/env python3
"""Quick test script for the extraction pipeline."""

import asyncio
import httpx

API_BASE = "http://localhost:8000"

# Test URLs
TEST_URLS = {
    "youtube": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",  # Replace with a cooking video
    "website": "https://www.seriouseats.com/easy-pan-fried-pork-chops-recipe",
}


async def test_post_endpoint(url: str) -> None:
    """Test the regular POST endpoint."""
    print(f"\n{'='*60}")
    print(f"Testing POST /api/v1/extract")
    print(f"URL: {url}")
    print("="*60)

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{API_BASE}/api/v1/extract",
            json={"url": url},
        )

        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                recipe = data["recipe"]
                print(f"✅ Success! Method: {data['method_used']}")
                print(f"   Title: {recipe['title']}")
                print(f"   Cuisine: {recipe.get('cuisine', 'N/A')}")
                print(f"   Ingredients: {len(recipe['ingredients'])}")
                print(f"   Instructions: {len(recipe['instructions'])}")
                print(f"   Thumbnail: {recipe.get('thumbnail_url', 'N/A')[:50]}...")
            else:
                print(f"❌ Failed: {data.get('error')}")
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            print(response.text)


async def test_sse_endpoint(url: str) -> None:
    """Test the SSE streaming endpoint."""
    print(f"\n{'='*60}")
    print(f"Testing GET /api/v1/extract/stream (SSE)")
    print(f"URL: {url}")
    print("="*60)

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "GET",
            f"{API_BASE}/api/v1/extract/stream",
            params={"url": url},
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("event:"):
                    event_type = line.split(":", 1)[1].strip()
                elif line.startswith("data:"):
                    import json
                    data = json.loads(line.split(":", 1)[1].strip())

                    if event_type == "progress":
                        percent = int(data["percent"] * 100)
                        tier = data.get("tier") or "..."
                        print(f"   [{percent:3d}%] [{tier}] {data['message']}")

                    elif event_type == "complete":
                        recipe = data["recipe"]
                        print(f"\n✅ Complete!")
                        print(f"   Title: {recipe['title']}")
                        print(f"   Cuisine: {recipe.get('cuisine', 'N/A')}")
                        print(f"   Ingredients: {len(recipe['ingredients'])}")
                        print(f"   Instructions: {len(recipe['instructions'])}")

                    elif event_type == "error":
                        print(f"\n❌ Error: {data['message']}")


async def test_health() -> None:
    """Test health endpoint."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{API_BASE}/api/v1/health")
        if response.status_code == 200:
            print("✅ Backend is healthy")
        else:
            print("❌ Backend is not responding")
            exit(1)


async def main() -> None:
    print("\n🧪 Recipe Extraction Pipeline Test\n")

    # Check health first
    await test_health()

    # Test with a website URL (faster, no video download)
    print("\n📄 Testing Website Extraction...")
    await test_post_endpoint(TEST_URLS["website"])

    print("\n📄 Testing Website with SSE...")
    await test_sse_endpoint(TEST_URLS["website"])

    # Uncomment to test video extraction (slower)
    # print("\n🎬 Testing Video Extraction...")
    # await test_post_endpoint(TEST_URLS["youtube"])
    #
    # print("\n🎬 Testing Video with SSE...")
    # await test_sse_endpoint(TEST_URLS["youtube"])


if __name__ == "__main__":
    asyncio.run(main())
