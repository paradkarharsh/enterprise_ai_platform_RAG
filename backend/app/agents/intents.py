"""
Intent Detection Agent.
Identifies user intent, domain, sentiment, urgency, and language.
"""
from typing import Dict, Any, List
import logging
import json
from app.llm.factory import generate_with_fallback, LLMMessage

logger = logging.getLogger(__name__)

async def detect_intent(
    query: str, 
    provider: str = None, 
    model: str = None
) -> Dict[str, Any]:
    """Detects multiple attributes of the user query."""
    
    system_prompt = """Analyze the user query and return a JSON object with the following schema:
{
  "intents": ["billing", "technical", "product", "complaint", "faq", "general"], // List of 1 or more matched intents
  "domain": "finance|it|sales|hr|legal",
  "sentiment": "positive|neutral|negative",
  "urgency": "low|medium|high",
  "language": "en|es|fr|etc",
  "rewritten_query": "optimized search query",
  "sub_queries": ["sub-query 1", "sub-query 2"],
  "metadata_filters": {"source_type": null}
}
Return ONLY valid JSON.
"""

    messages = [
        LLMMessage(role="system", content=system_prompt),
        LLMMessage(role="user", content=query),
    ]

    try:
        response = await generate_with_fallback(
            messages,
            provider_name=provider,
            model=model,
            temperature=0.1,
            max_tokens=1024,
        )
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            
        data = json.loads(content)
        # Ensure intents is a list
        if isinstance(data.get("intents"), str):
            data["intents"] = [data["intents"]]
        elif not data.get("intents"):
            data["intents"] = ["general"]
            
        return data
    except Exception as e:
        logger.error(f"Intent detection failed: {e}")
        return {
            "intents": ["general"],
            "domain": "general",
            "sentiment": "neutral",
            "urgency": "low",
            "language": "en",
            "rewritten_query": query,
            "sub_queries": [],
            "metadata_filters": {}
        }
