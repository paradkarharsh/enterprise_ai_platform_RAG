"""
Specialized Domain Agents for Customer Support.
"""
from typing import Dict, Any, List
import logging
from app.llm.factory import generate_with_fallback, LLMMessage

logger = logging.getLogger(__name__)

async def call_specialized_agent(
    agent_type: str, 
    query: str, 
    context: str, 
    history: List[Dict[str, str]], 
    provider: str = None, 
    model: str = None
) -> str:
    """Invokes a specialized agent with its specific prompt."""
    
    prompts = {
        "billing": "You are the Billing Support Agent. Handle invoices, payments, refunds, subscriptions, and billing history. Use precise financial language. Rely strictly on the provided context.",
        "technical": "You are the Technical Support Agent. Handle login issues, installation, bugs, errors, and troubleshooting. Provide step-by-step technical guidance based on the context.",
        "product": "You are the Product Agent. Handle product details, pricing, comparisons, and recommendations. Highlight features and benefits accurately based on context.",
        "complaint": "You are the Complaint Agent. Handle complaint registration, escalation, and issue tracking. Be highly empathetic, professional, and de-escalate the situation.",
        "faq": "You are the FAQ Agent. Answer questions about company policies, shipping, warranty, and contact details.",
        "general": "You are the General Support Agent. Provide helpful, accurate assistance based on the context."
    }
    
    system_prompt = prompts.get(agent_type, prompts["general"])
    
    messages = [
        LLMMessage(role="system", content=f"{system_prompt}\n\nContext:\n{context}"),
    ]
    
    for msg in history[-5:]:
        messages.append(LLMMessage(role=msg["role"], content=msg["content"]))
        
    messages.append(LLMMessage(role="user", content=query))
    
    try:
        response = await generate_with_fallback(
            messages,
            provider_name=provider,
            model=model,
            temperature=0.3,
            max_tokens=2048,
        )
        return response.content
    except Exception as e:
        logger.error(f"{agent_type} agent failed: {e}")
        return f"Error connecting to {agent_type} agent: {str(e)}"
