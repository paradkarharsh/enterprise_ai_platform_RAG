from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
import uuid

from app.db.postgres import get_db
from app.db.models import SupportTicket, User
from app.auth.jwt import get_current_user
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class TicketResponse(BaseModel):
    id: uuid.UUID
    department: str
    status: str
    priority: str
    summary: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_agent_id: Optional[uuid.UUID] = None

@router.get("/", response_model=List[TicketResponse])
async def get_tickets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get tickets. Admins see all, users see their own."""
    if current_user.role == "admin":
        result = await db.execute(select(SupportTicket).order_by(SupportTicket.created_at.desc()))
    else:
        result = await db.execute(select(SupportTicket).where(SupportTicket.user_id == current_user.id).order_by(SupportTicket.created_at.desc()))
    return result.scalars().all()

@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = await db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user.role != "admin" and ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this ticket")
    return ticket

@router.patch("/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: uuid.UUID,
    update_data: TicketUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update tickets")
        
    ticket = await db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if update_data.status:
        ticket.status = update_data.status
    if update_data.priority:
        ticket.priority = update_data.priority
    if update_data.assigned_agent_id:
        ticket.assigned_agent_id = update_data.assigned_agent_id
        
    await db.commit()
    await db.refresh(ticket)
    return ticket
