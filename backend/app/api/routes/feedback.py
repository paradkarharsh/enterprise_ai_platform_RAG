from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid

from app.db.postgres import get_db
from app.db.models import Feedback, Message, User
from app.auth.jwt import get_current_user
from pydantic import BaseModel

router = APIRouter()

class FeedbackCreate(BaseModel):
    message_id: uuid.UUID
    is_helpful: Optional[bool] = None
    rating: Optional[int] = None
    comment: Optional[str] = None

@router.post("")
async def submit_feedback(
    feedback_in: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify message exists
    message = await db.get(Message, feedback_in.message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
        
    feedback = Feedback(
        message_id=feedback_in.message_id,
        is_helpful=feedback_in.is_helpful,
        rating=feedback_in.rating,
        comment=feedback_in.comment
    )
    
    db.add(feedback)
    
    # Also update the message directly for quick access
    if feedback_in.is_helpful is True:
        message.feedback = "thumbs_up"
    elif feedback_in.is_helpful is False:
        message.feedback = "thumbs_down"
        
    await db.commit()
    return {"status": "success", "message": "Feedback submitted successfully"}
