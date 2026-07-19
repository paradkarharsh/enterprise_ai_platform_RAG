import os
import shutil
import tempfile
import logging
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


@router.post("/speech-to-text")
async def speech_to_text(audio: UploadFile = File(...)):
    """Convert audio file to text using OpenAI Whisper API if available, or fall back to mock."""
    logger.info(f"Received audio file for STT: {audio.filename}")

    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY is not set. Returning mock transcription.")
        return {"text": "This is a mock transcription because no OpenAI API key was configured."}

    try:
        ext = os.path.splitext(audio.filename)[1] or ".wav"
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            shutil.copyfileobj(audio.file, tmp)
            tmp_path = tmp.name

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        with open(tmp_path, "rb") as audio_file:
            transcript = await client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )

        try:
            os.remove(tmp_path)
        except Exception:
            pass

        return {"text": transcript.text}
    except Exception as e:
        logger.error(f"Error during speech-to-text: {e}")
        raise HTTPException(status_code=500, detail=f"Speech-to-text failed: {str(e)}")


@router.post("/text-to-speech")
async def text_to_speech(text: str):
    """Convert text to speech audio stream using OpenAI TTS if available, or fall back to mock."""
    logger.info(f"Received text for TTS: {text[:50]}")

    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY is not set. Returning mock audio stream.")
        def generate_mock_audio():
            yield b"mock_audio_data"
        return StreamingResponse(generate_mock_audio(), media_type="audio/mpeg")

    try:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=text
        )

        async def generate_audio():
            yield response.content

        return StreamingResponse(generate_audio(), media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"Error during text-to-speech: {e}")
        raise HTTPException(status_code=500, detail=f"Text-to-speech failed: {str(e)}")
