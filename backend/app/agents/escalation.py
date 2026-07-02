"""
Human Escalation System.
Creates support tickets when confidence is low or user requests human intervention.
"""
from typing import Dict, Any, List
import logging
from app.db.postgres import get_db
from app.db.models import SupportTicket

logger = logging.getLogger(__name__)

async def check_escalation(
    query: str, 
    confidence_score: float, 
    threshold: float = 0.5,
    user_id: str = None,
    conversation_summary: str = "",
    department: str = "general"
) -> Dict[str, Any]:
    """
    Checks if a query needs human escalation based on confidence score
    or explicit user request.
    """
    needs_escalation = False
    reason = ""
    
    # Check for explicit human request
    human_keywords = ["talk to a human", "customer service", "agent", "real person", "escalate"]
    if any(kw in query.lower() for kw in human_keywords):
        needs_escalation = True
        reason = "User explicitly requested human agent"
    
    # Check confidence threshold
    elif confidence_score < threshold:
        needs_escalation = True
        reason = f"Low AI confidence score ({confidence_score} < {threshold})"
        
    if needs_escalation and user_id:
        try:
            # Create a ticket in the database
            from sqlalchemy.ext.asyncio import AsyncSession
            import uuid
            
            # Since we need a session, we'll get one dynamically
            async for db in get_db():
                new_ticket = SupportTicket(
                    user_id=uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
                    department=department,
                    summary=f"Reason: {reason}\nQuery: {query}\n\nContext:\n{conversation_summary}"
                )
                db.add(new_ticket)
                await db.commit()
                
                logger.info(f"Escalated to human. Created ticket {new_ticket.id}")
                return {
                    "escalated": True,
                    "ticket_id": str(new_ticket.id),
                    "reason": reason
                }
        except Exception as e:
            logger.error(f"Failed to create support ticket: {e}")
            
    return {
        "escalated": needs_escalation,
        "reason": reason
    }
