"""
JWT Authentication: token creation, validation, and password hashing.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

# Workaround for passlib + bcrypt >= 4.0.0 compatibility
try:
    import bcrypt
    
    # Wrap hashpw and checkpw to truncate password if > 72 bytes to avoid ValueError
    _orig_hashpw = bcrypt.hashpw
    def _safe_hashpw(password, salt):
        if isinstance(password, bytes) and len(password) > 72:
            password = password[:72]
        elif isinstance(password, str) and len(password) > 72:
            password = password[:72]
        return _orig_hashpw(password, salt)
    bcrypt.hashpw = _safe_hashpw

    _orig_checkpw = bcrypt.checkpw
    def _safe_checkpw(password, hashed_password):
        if isinstance(password, bytes) and len(password) > 72:
            password = password[:72]
        elif isinstance(password, str) and len(password) > 72:
            password = password[:72]
        return _orig_checkpw(password, hashed_password)
    bcrypt.checkpw = _safe_checkpw

    if not hasattr(bcrypt, "__about__"):
        class BcryptAbout:
            __version__ = getattr(bcrypt, "__version__", "4.0.0")
        bcrypt.__about__ = BcryptAbout()
except ImportError:
    pass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.postgres import get_db
from app.db.models import User

logger = logging.getLogger(__name__)
settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


class TokenPayload(BaseModel):
    sub: str
    exp: datetime
    role: str
    type: str = "access"


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: str, role: str) -> str:
    """Create a JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "exp": expire,
        "role": role,
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str, role: str) -> str:
    """Create a JWT refresh token."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "exp": expire,
        "role": role,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_tokens(user_id: str, role: str) -> TokenResponse:
    """Create both access and refresh tokens."""
    return TokenResponse(
        access_token=create_access_token(user_id, role),
        refresh_token=create_refresh_token(user_id, role),
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency: extract and validate current user from JWT."""
    payload = decode_token(credentials.credentials)

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is disabled")

    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Dependency: optionally extract user (for public endpoints)."""
    if not credentials:
        return None
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None
