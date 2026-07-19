from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
import logging
import httpx
from app.config import get_settings
from app.agents.graph import run_agent_pipeline

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


async def process_slack_message(text: str, channel: str):
    """Background task to run RAG pipeline and post response to Slack."""
    try:
        logger.info(f"Processing Slack message: '{text}' for channel {channel}")
        state = await run_agent_pipeline(query=text)
        response_text = state.get("response", "Sorry, I could not process your query.")

        if settings.SLACK_BOT_TOKEN:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://slack.com/api/chat.postMessage",
                    headers={"Authorization": f"Bearer {settings.SLACK_BOT_TOKEN}"},
                    json={"channel": channel, "text": response_text}
                )
                logger.info(f"Slack postMessage response status: {resp.status_code}")
        else:
            logger.warning("SLACK_BOT_TOKEN is not set. Cannot send message to Slack.")
    except Exception as e:
        logger.error(f"Error in process_slack_message task: {e}")


async def process_discord_message(text: str, webhook_url: str = None):
    """Background task to run RAG pipeline and post response to Discord."""
    try:
        logger.info(f"Processing Discord message: '{text}'")
        state = await run_agent_pipeline(query=text)
        response_text = state.get("response", "Sorry, I could not process your query.")

        target_url = webhook_url or settings.DISCORD_WEBHOOK_URL
        if target_url:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    target_url,
                    json={"content": response_text}
                )
                logger.info(f"Discord webhook response status: {resp.status_code}")
        else:
            logger.warning("Discord webhook URL is not configured.")
    except Exception as e:
        logger.error(f"Error in process_discord_message task: {e}")


@router.post("/slack/webhook")
async def slack_webhook(request: Request, background_tasks: BackgroundTasks):
    """Webhook for Slack integration (API-ready)."""
    try:
        payload = await request.json()
        logger.info(f"Received Slack webhook: {payload}")

        # URL Verification Challenge for Slack
        if payload.get("type") == "url_verification":
            return {"challenge": payload.get("challenge")}

        # Process messages
        event = payload.get("event", {})
        event_type = event.get("type")

        if event_type == "message" and not event.get("bot_id") and not event.get("subtype"):
            text = event.get("text")
            channel = event.get("channel")
            if text and channel:
                background_tasks.add_task(process_slack_message, text, channel)

        return {"status": "received"}
    except Exception as e:
        logger.error(f"Error processing Slack webhook: {e}")
        return {"status": "error", "detail": str(e)}


@router.post("/teams/webhook")
async def teams_webhook(request: Request, background_tasks: BackgroundTasks):
    """Webhook for Microsoft Teams integration."""
    payload = await request.json()
    logger.info(f"Received Teams webhook: {payload}")
    return {"status": "received"}


@router.post("/whatsapp/webhook")
async def whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    """Webhook for WhatsApp integration (API-ready)."""
    payload = await request.json()
    logger.info(f"Received WhatsApp webhook: {payload}")
    return {"status": "received"}


@router.post("/discord/webhook")
async def discord_webhook(request: Request, background_tasks: BackgroundTasks):
    """Webhook for Discord integration."""
    try:
        payload = await request.json()
        logger.info(f"Received Discord webhook: {payload}")

        # Extract message text (e.g. from interaction or message payload)
        text = payload.get("content")
        if text:
            # Check if there is an interaction callback or response URL
            webhook_url = payload.get("response_url")
            background_tasks.add_task(process_discord_message, text, webhook_url)

        return {"status": "received"}
    except Exception as e:
        logger.error(f"Error processing Discord webhook: {e}")
        return {"status": "error", "detail": str(e)}
