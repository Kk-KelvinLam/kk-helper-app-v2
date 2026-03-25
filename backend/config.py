"""Application configuration."""

import os


# CORS origins allowed to call the API
CORS_ORIGINS: list[str] = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:4173"
).split(",")

# Tesseract binary path (override if not on $PATH)
TESSERACT_CMD: str | None = os.getenv("TESSERACT_CMD")

# Maximum image file size in bytes (default 10 MB)
MAX_IMAGE_SIZE: int = int(os.getenv("MAX_IMAGE_SIZE", str(10 * 1024 * 1024)))
