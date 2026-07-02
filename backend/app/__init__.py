# Enterprise AI Knowledge Platform - Backend
__version__ = "1.0.0"

# Workaround for passlib + bcrypt >= 4.0.0 compatibility
try:
    import bcrypt
    if not hasattr(bcrypt, "__about__"):
        class BcryptAbout:
            __version__ = getattr(bcrypt, "__version__", "4.0.0")
        bcrypt.__about__ = BcryptAbout()
except ImportError:
    pass

