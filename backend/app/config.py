"""
Application configuration using Pydantic Settings.
Loads from environment variables and .env file.
"""
from pydantic_settings import BaseSettings
from typing import Optional, List
from functools import lru_cache


class Settings(BaseSettings):
    """Global application settings."""

    # Application
    APP_NAME: str = "Enterprise AI Knowledge Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change-this-in-production-use-openssl-rand-hex-32"
    API_PREFIX: str = "/api/v1"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000", "http://localhost:3001"]

    # Database - PostgreSQL
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "enterprise_ai"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"

    @property
    def DATABASE_URL(self) -> str:
        import os
        env_url = os.environ.get("DATABASE_URL")
        if env_url:
            if env_url.startswith("postgresql://"):
                env_url = env_url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return env_url
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def DATABASE_URL_SYNC(self) -> str:
        import os
        env_url = os.environ.get("DATABASE_URL")
        if env_url:
            if env_url.startswith("postgresql+asyncpg://"):
                env_url = env_url.replace("postgresql+asyncpg://", "postgresql://", 1)
            return env_url
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    REDIS_DB: int = 0

    @property
    def REDIS_URL(self) -> str:
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # Neo4j
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "neo4j_password"

    # AI Providers
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    DEFAULT_LLM_PROVIDER: str = "gemini"
    DEFAULT_LLM_MODEL: str = "gemini-2.0-flash"

    # Embeddings
    DEFAULT_EMBEDDING_PROVIDER: str = "openai"
    DEFAULT_EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSION: int = 1536

    # Vector Store
    DEFAULT_VECTOR_STORE: str = "chroma"
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8100
    CHROMA_COLLECTION: str = "enterprise_knowledge"
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_INDEX: str = "enterprise-knowledge"
    PINECONE_ENVIRONMENT: str = "us-east-1"
    WEAVIATE_URL: str = "http://localhost:8080"
    WEAVIATE_API_KEY: Optional[str] = None
    FAISS_INDEX_PATH: str = "./data/faiss_index"

    # JWT Auth
    JWT_SECRET_KEY: str = "jwt-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    OAUTH_REDIRECT_URI: str = "http://localhost:3000/auth/callback"

    # Webhook Integrations
    SLACK_BOT_TOKEN: Optional[str] = None
    SLACK_SIGNING_SECRET: Optional[str] = None
    DISCORD_WEBHOOK_URL: Optional[str] = None
    WHATSAPP_API_TOKEN: Optional[str] = None
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000

    # File Upload
    MAX_UPLOAD_SIZE_MB: int = 100
    UPLOAD_DIR: str = "./uploads"
    
    @property
    def UPLOADS_ABSOLUTE_DIR(self) -> str:
        """Resolve UPLOAD_DIR to an absolute path."""
        from pathlib import Path
        upload_path = Path(self.UPLOAD_DIR)
        if upload_path.is_absolute():
            return str(upload_path)
        # Resolve relative to the backend directory (where config.py is)
        backend_dir = Path(__file__).parent.parent.parent
        return str(backend_dir / self.UPLOAD_DIR)

    ALLOWED_EXTENSIONS: List[str] = [
        ".pdf", ".docx", ".pptx", ".txt", ".csv",
        ".xlsx", ".xls", ".eml", ".msg", ".html",
        ".md", ".markdown"
    ]

    @property
    def UPLOADS_ABSOLUTE_DIR(self) -> str:
        """Resolve UPLOAD_DIR to an absolute path based on the backend directory."""
        from pathlib import Path
        base_dir = Path(__file__).resolve().parent.parent.parent  # backend/app/config.py -> backend/
        upload_path = Path(self.UPLOAD_DIR)
        if not upload_path.is_absolute():
            upload_path = base_dir / upload_path
        return str(upload_path.resolve())

    # Chunking
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
