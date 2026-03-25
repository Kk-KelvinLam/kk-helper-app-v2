"""FastAPI application for KK Helper OCR backend.

Provides REST API endpoints for server-side image data extraction using
Python, OpenCV, and pytesseract. Replaces the client-side Tesseract.js
implementation with a more powerful server-side OCR pipeline.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.ocr import router as ocr_router
from backend.config import CORS_ORIGINS
from backend.models.schemas import HealthResponse
from backend.services.ocr_service import is_tesseract_available

app = FastAPI(
    title="KK Helper OCR Backend",
    description="Server-side image data extraction API using Python, OpenCV, and pytesseract",
    version="1.0.0",
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(ocr_router)


@app.get("/api/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint to verify the service and Tesseract availability."""
    return HealthResponse(
        status="ok",
        tesseract_available=is_tesseract_available(),
    )
