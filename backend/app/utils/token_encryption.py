"""Encrypt OAuth tokens at rest (Fernet keyed from app secret)."""

from __future__ import annotations

import base64

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.core.config import jwt_signing_key

_SALT = b"ww360_doc_studio_oauth_2026"


class TokenEncryptor:
    def encrypt_value(self, value: str) -> str:
        if not value:
            return value
        return _fernet().encrypt(value.encode()).decode()

    def decrypt_value(self, encrypted_value: str) -> str:
        if not encrypted_value:
            return encrypted_value
        try:
            return _fernet().decrypt(encrypted_value.encode()).decode()
        except Exception:
            return encrypted_value


def _fernet() -> Fernet:
    password = jwt_signing_key()
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_SALT,
        iterations=100_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
    return Fernet(key)


def encrypt_value(value: str) -> str:
    return TokenEncryptor().encrypt_value(value)


def decrypt_value(encrypted_value: str) -> str:
    return TokenEncryptor().decrypt_value(encrypted_value)


def get_token_encryptor() -> TokenEncryptor:
    return TokenEncryptor()
