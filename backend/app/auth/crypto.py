"""
Encryption and masking utilities for sensitive user credentials (e.g. LLM API keys).
Uses Fernet encryption when cryptography is available, with an authenticated HMAC-SHA256
stream cipher fallback using standard library modules (hashlib, hmac, base64, secrets).
"""
import os
import base64
import hashlib
import hmac
import secrets
from typing import Optional
from app.config import get_settings

settings = get_settings()


def _get_derived_key() -> bytes:
    """Derive a 32-byte key from the application SECRET_KEY."""
    secret = (settings.SECRET_KEY or "fallback-secret-for-api-key-encryption").encode("utf-8")
    return hashlib.sha256(secret).digest()


def encrypt_api_key(raw_key: str) -> str:
    """Encrypt a plaintext API key. Returns a base64 encoded encrypted string."""
    if not raw_key:
        return ""
    
    raw_bytes = raw_key.strip().encode("utf-8")
    key = _get_derived_key()

    try:
        from cryptography.fernet import Fernet
        f_key = base64.urlsafe_b64encode(key)
        fernet = Fernet(f_key)
        encrypted = fernet.encrypt(raw_bytes)
        return "fn:" + encrypted.decode("utf-8")
    except Exception:
        # Fallback: Authenticated HMAC-SHA256 keystream cipher
        # 16-byte random IV/nonce
        nonce = secrets.token_bytes(16)
        # Generate pseudo-random keystream via HMAC
        keystream = bytearray()
        block_idx = 0
        while len(keystream) < len(raw_bytes):
            block = hmac.new(key, nonce + block_idx.to_bytes(4, "big"), hashlib.sha256).digest()
            keystream.extend(block)
            block_idx += 1
        
        # XOR payload with keystream
        ciphertext = bytes(b ^ k for b, k in zip(raw_bytes, keystream[:len(raw_bytes)]))
        # Compute auth tag over nonce + ciphertext
        tag = hmac.new(key, nonce + ciphertext, hashlib.sha256).digest()[:16]
        payload = nonce + tag + ciphertext
        return "sc:" + base64.urlsafe_b64encode(payload).decode("utf-8")


def decrypt_api_key(encrypted_str: str) -> str:
    """Decrypt an encrypted API key back to plaintext."""
    if not encrypted_str:
        return ""
    
    key = _get_derived_key()

    if encrypted_str.startswith("fn:"):
        payload = encrypted_str[3:].encode("utf-8")
        from cryptography.fernet import Fernet
        f_key = base64.urlsafe_b64encode(key)
        fernet = Fernet(f_key)
        return fernet.decrypt(payload).decode("utf-8")
    elif encrypted_str.startswith("sc:"):
        payload = base64.urlsafe_b64decode(encrypted_str[3:].encode("utf-8"))
        if len(payload) < 32:
            raise ValueError("Corrupt encrypted payload")
        nonce = payload[:16]
        tag = payload[16:32]
        ciphertext = payload[32:]

        # Verify authentication tag
        expected_tag = hmac.new(key, nonce + ciphertext, hashlib.sha256).digest()[:16]
        if not hmac.compare_digest(tag, expected_tag):
            raise ValueError("API key signature verification failed (tampered or wrong SECRET_KEY)")

        # Recompute keystream
        keystream = bytearray()
        block_idx = 0
        while len(keystream) < len(ciphertext):
            block = hmac.new(key, nonce + block_idx.to_bytes(4, "big"), hashlib.sha256).digest()
            keystream.extend(block)
            block_idx += 1

        plaintext = bytes(c ^ k for c, k in zip(ciphertext, keystream[:len(ciphertext)]))
        return plaintext.decode("utf-8")
    else:
        # Backward compatibility: if it was raw, return as is
        return encrypted_str


def mask_api_key(api_key: Optional[str]) -> str:
    """Mask an API key for safe display in UI/API responses."""
    if not api_key:
        return ""
    api_key = api_key.strip()
    if len(api_key) <= 8:
        return "••••••••"
    prefix = api_key[:4]
    suffix = api_key[-4:]
    return f"{prefix}••••••••{suffix}"
