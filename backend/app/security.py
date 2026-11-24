import secrets
from fastapi import Header, HTTPException, status
from app.config import settings


def verify_internal_secret(
    x_internal_secret: str | None = Header(default=None, alias="X-Internal-Secret"),
) -> None:
    if not x_internal_secret or not secrets.compare_digest(
        x_internal_secret, settings.internal_api_secret
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Internal-Secret header",
        )