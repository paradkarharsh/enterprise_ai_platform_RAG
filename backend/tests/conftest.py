"""pytest configuration."""
import pytest

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



@pytest.fixture
def mock_settings():
    """Provide test settings."""
    from app.config import Settings
    return Settings(
        DEBUG=True,
        ENVIRONMENT="test",
        POSTGRES_DB="test_db",
        SECRET_KEY="test-secret-key",
        JWT_SECRET_KEY="test-jwt-secret",
    )
