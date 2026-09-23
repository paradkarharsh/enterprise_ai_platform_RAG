"""
Authentication API routes: register, login, OAuth, token refresh.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.db.models import User, UserRole
from app.auth.jwt import hash_password, verify_password, create_tokens, decode_token, get_current_user, TokenResponse
from app.auth.oauth import GoogleOAuth, GitHubOAuth

logger = logging.getLogger(__name__)
router = APIRouter()


class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class OAuthCallbackRequest(BaseModel):
    code: str
    provider: str  # google, github


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: Optional[str]
    avatar_url: Optional[str]
    role: str
    is_active: bool
    created_at: str
    has_api_key: bool = False
    default_provider: Optional[str] = "gemini"

    class Config:
        from_attributes = True


class SaveLLMKeyRequest(BaseModel):
    provider: str  # gemini, groq, openai, claude
    api_key: str
    set_as_default: bool = True
    validate_key: bool = True


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    # Check existing user
    existing = await db.execute(select(User).where((User.email == request.email) | (User.username == request.username)))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email or username already exists")

    user = User(
        email=request.email,
        username=request.username,
        hashed_password=hash_password(request.password),
        full_name=request.full_name,
        role=UserRole.VIEWER,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.flush()

    tokens = create_tokens(str(user.id), user.role.value)
    logger.info("New user registered: %s", request.email)
    return tokens


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    user.last_login = datetime.now(timezone.utc)
    await db.flush()

    return create_tokens(str(user.id), user.role.value)


@router.post("/oauth/callback", response_model=TokenResponse)
async def oauth_callback(request: OAuthCallbackRequest, db: AsyncSession = Depends(get_db)):
    """Handle OAuth callback from Google or GitHub."""
    if request.provider == "google":
        user_info = await GoogleOAuth.exchange_code(request.code)
    elif request.provider == "github":
        user_info = await GitHubOAuth.exchange_code(request.code)
    else:
        raise HTTPException(status_code=400, detail="Unsupported OAuth provider")

    # Find or create user
    result = await db.execute(
        select(User).where(User.oauth_provider == user_info.provider, User.oauth_id == user_info.oauth_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        # Check if email already exists
        result = await db.execute(select(User).where(User.email == user_info.email))
        user = result.scalar_one_or_none()

        if user:
            # Link OAuth to existing account
            user.oauth_provider = user_info.provider
            user.oauth_id = user_info.oauth_id
            if user_info.avatar_url:
                user.avatar_url = user_info.avatar_url
        else:
            # Create new user
            user = User(
                email=user_info.email,
                username=user_info.email.split("@")[0] + "_" + str(uuid.uuid4())[:4],
                full_name=user_info.name,
                avatar_url=user_info.avatar_url,
                oauth_provider=user_info.provider,
                oauth_id=user_info.oauth_id,
                role=UserRole.VIEWER,
                is_active=True,
                is_verified=True,
            )
            db.add(user)

    user.last_login = datetime.now(timezone.utc)
    await db.flush()

    return create_tokens(str(user.id), user.role.value)


@router.get("/oauth/url/{provider}")
async def get_oauth_url(provider: str):
    """Get OAuth authorization URL."""
    state = str(uuid.uuid4())
    if provider == "google":
        return {"url": GoogleOAuth.get_auth_url(state), "state": state}
    elif provider == "github":
        return {"url": GitHubOAuth.get_auth_url(state), "state": state}
    raise HTTPException(status_code=400, detail="Unsupported provider")


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    """Refresh access token."""
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    return create_tokens(payload["sub"], payload["role"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        username=current_user.username,
        full_name=current_user.full_name,
        avatar_url=current_user.avatar_url,
        role=current_user.role.value,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat() if current_user.created_at else "",
        has_api_key=current_user.has_configured_llm_key(),
        default_provider=(current_user.preferences or {}).get("default_llm_provider", "gemini"),
    )


@router.get("/llm-keys")
async def get_llm_keys(current_user: User = Depends(get_current_user)):
    """Get status of user's configured LLM API keys (masked for safety)."""
    from app.auth.crypto import mask_api_key
    keys = current_user.get_all_llm_api_keys()
    providers_status = {}
    for prov in ["gemini", "groq", "openai", "claude"]:
        raw = keys.get(prov)
        providers_status[prov] = {
            "configured": bool(raw),
            "preview": mask_api_key(raw) if raw else None,
        }
    default_prov = (current_user.preferences or {}).get("default_llm_provider", "gemini")
    return {
        "has_api_key": current_user.has_configured_llm_key(),
        "default_provider": default_prov,
        "providers": providers_status,
    }


@router.post("/llm-keys")
async def save_llm_key(
    request: SaveLLMKeyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save and validate a user's personal LLM API key."""
    provider = request.provider.lower().strip()
    raw_key = request.api_key.strip()
    if not raw_key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")

    if request.validate_key:
        from app.llm.factory import validate_api_key
        try:
            is_valid = await validate_api_key(provider, raw_key)
            if not is_valid:
                raise HTTPException(
                    status_code=400,
                    detail=f"Validation ping failed for {provider}. Please ensure your API key is active."
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("API key validation failed: %s", e)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid {provider.title()} API key: {str(e)}"
            )

    current_user.set_llm_api_key(provider, raw_key, default=request.set_as_default)
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    from app.auth.crypto import mask_api_key
    return {
        "status": "success",
        "message": f"{provider.title()} API key verified and saved successfully.",
        "has_api_key": current_user.has_configured_llm_key(),
        "provider": provider,
        "preview": mask_api_key(raw_key),
    }


@router.delete("/llm-keys/{provider}")
async def delete_llm_key(
    provider: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a user's configured LLM API key."""
    prov = provider.lower().strip()
    current_user.delete_llm_api_key(prov)
    db.add(current_user)
    await db.commit()
    return {
        "status": "success",
        "message": f"{prov.title()} API key removed.",
        "has_api_key": current_user.has_configured_llm_key(),
    }
