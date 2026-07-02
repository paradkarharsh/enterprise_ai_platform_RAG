"""
OAuth2 integration for Google and GitHub authentication.
"""
import logging
from typing import Optional
import httpx
from pydantic import BaseModel
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class OAuthUserInfo(BaseModel):
    """Standardized OAuth user info."""
    provider: str
    oauth_id: str
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class GoogleOAuth:
    """Google OAuth2 provider."""

    AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

    @staticmethod
    def get_auth_url(state: str) -> str:
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.OAUTH_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{GoogleOAuth.AUTH_URL}?{query}"

    @staticmethod
    async def exchange_code(code: str) -> OAuthUserInfo:
        async with httpx.AsyncClient() as client:
            # Exchange code for token
            token_response = await client.post(
                GoogleOAuth.TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.OAUTH_REDIRECT_URI,
                },
            )
            token_data = token_response.json()
            access_token = token_data["access_token"]

            # Get user info
            user_response = await client.get(
                GoogleOAuth.USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_data = user_response.json()

            return OAuthUserInfo(
                provider="google",
                oauth_id=user_data["id"],
                email=user_data["email"],
                name=user_data.get("name"),
                avatar_url=user_data.get("picture"),
            )


class GitHubOAuth:
    """GitHub OAuth2 provider."""

    AUTH_URL = "https://github.com/login/oauth/authorize"
    TOKEN_URL = "https://github.com/login/oauth/access_token"
    USERINFO_URL = "https://api.github.com/user"
    EMAIL_URL = "https://api.github.com/user/emails"

    @staticmethod
    def get_auth_url(state: str) -> str:
        params = {
            "client_id": settings.GITHUB_CLIENT_ID,
            "redirect_uri": settings.OAUTH_REDIRECT_URI,
            "scope": "user:email read:user",
            "state": state,
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{GitHubOAuth.AUTH_URL}?{query}"

    @staticmethod
    async def exchange_code(code: str) -> OAuthUserInfo:
        async with httpx.AsyncClient() as client:
            # Exchange code for token
            token_response = await client.post(
                GitHubOAuth.TOKEN_URL,
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                },
                headers={"Accept": "application/json"},
            )
            token_data = token_response.json()
            access_token = token_data["access_token"]

            headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            }

            # Get user info
            user_response = await client.get(GitHubOAuth.USERINFO_URL, headers=headers)
            user_data = user_response.json()

            # Get email if not public
            email = user_data.get("email")
            if not email:
                email_response = await client.get(GitHubOAuth.EMAIL_URL, headers=headers)
                emails = email_response.json()
                primary = next((e for e in emails if e.get("primary")), emails[0] if emails else None)
                email = primary["email"] if primary else f"{user_data['login']}@github.local"

            return OAuthUserInfo(
                provider="github",
                oauth_id=str(user_data["id"]),
                email=email,
                name=user_data.get("name") or user_data["login"],
                avatar_url=user_data.get("avatar_url"),
            )
