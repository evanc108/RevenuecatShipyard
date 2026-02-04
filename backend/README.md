# Universal Recipe Extractor Backend

A FastAPI-based service that extracts structured recipes from video content using a tiered fallback pipeline.

## Architecture

The extraction pipeline uses three tiers, falling back to the next if the current tier fails:

1. **Metadata Tier** (Fastest)
   - Scrapes video description and top comments via `yt-dlp`
   - Parses with GPT-4o-mini for structured recipe data

2. **Audio Tier** (Fallback)
   - Downloads audio and transcribes with OpenAI Whisper
   - Parses transcript for ingredients and instructions

3. **Vision Tier** (Deep Fallback)
   - Extracts key frames from video
   - Analyzes with GPT-4o-mini for text overlays and visual cues

## Setup

### Prerequisites

- Python 3.11+
- ffmpeg (for audio/video processing)
- Convex project configured

### Installation

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o-mini and Whisper |

### Running

```bash
# Development with auto-reload
uvicorn app.main:app --reload --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API

### POST `/api/v1/extract`

Submit a video URL for recipe extraction.

**Request:**
```json
{
  "url": "https://tiktok.com/@user/video/123",
  "user_id": "convex_user_id"
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "abc123",
  "status": "pending",
  "message": "Extraction job queued successfully"
}
```

The job runs asynchronously. Poll the Convex `extractionJobs` table for status updates.

### GET `/api/v1/health`

Health check endpoint.

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── routes.py       # API endpoints
│   ├── schemas/
│   │   └── extraction.py   # Pydantic models
│   ├── services/
│   │   ├── extractors/
│   │   │   ├── base.py             # Abstract extractor
│   │   │   ├── metadata_extractor.py
│   │   │   ├── audio_extractor.py
│   │   │   └── vision_extractor.py
│   │   ├── convex_client.py        # Convex integration
│   │   └── extraction_pipeline.py  # Tier orchestration
│   ├── config.py           # Settings management
│   └── main.py             # FastAPI app
├── tests/
├── requirements.txt
├── pyproject.toml
└── .env.example
```

## Development

### Code Style

This project uses [Ruff](https://docs.astral.sh/ruff/) for linting and formatting:

```bash
# Lint
ruff check .

# Format
ruff format .
```

### Testing

```bash
pytest
```

## Recipe Output Schema

All tiers produce the same structured output:

```json
{
  "title": "Garlic Butter Pasta",
  "ingredients": [
    {"item": "pasta", "amount": "1", "unit": "lb"},
    {"item": "garlic", "amount": "4", "unit": "cloves"}
  ],
  "instructions": [
    "Boil pasta according to package directions",
    "Sauté minced garlic in butter"
  ],
  "method_used": "metadata",
  "prep_time_minutes": 10,
  "cook_time_minutes": 15,
  "servings": 4
}
```
