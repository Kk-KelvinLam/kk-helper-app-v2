"""Pydantic models for OCR API request and response schemas."""

from pydantic import BaseModel, Field


class OcrRequest(BaseModel):
    """Request body for general OCR extraction."""

    image: str = Field(
        ...,
        description="Base64-encoded image data (with or without data-URL prefix)",
    )
    language: str = Field(
        default="eng",
        description="Tesseract language string, e.g. 'eng', 'eng+chi_tra+chi_sim'",
    )


class OcrResponse(BaseModel):
    """Response body for general OCR extraction."""

    text: str = Field(description="Extracted text")
    confidence: float = Field(description="OCR confidence score (0-100)")


class BPExtractionRequest(BaseModel):
    """Request body for blood pressure extraction from a monitor photo."""

    image: str = Field(
        ...,
        description="Base64-encoded image data (with or without data-URL prefix)",
    )
    language: str = Field(
        default="eng+chi_tra+chi_sim",
        description="Tesseract language string for primary OCR pass",
    )


class BPExtractionResponse(BaseModel):
    """Response body containing extracted blood pressure values."""

    systolic: str = Field(default="", description="Systolic pressure (e.g. '120')")
    diastolic: str = Field(default="", description="Diastolic pressure (e.g. '80')")
    heart_rate: str = Field(default="", description="Heart rate (e.g. '72')")
    strategy: int | None = Field(
        default=None,
        description="Parsing strategy used (1=labeled, 2=slash, 3=numbers-only)",
    )
    irregular_heartbeat: bool | None = Field(
        default=None, description="Whether IHB indicator was detected"
    )
    raw_text: str = Field(default="", description="Raw OCR text from primary pass")
    digit_only_text: str = Field(
        default="", description="Raw OCR text from digit-only pass"
    )
    confidence: float = Field(default=0.0, description="OCR confidence score (0-100)")
    is_bp_monitor: bool | None = Field(
        default=None,
        description="Whether the image was classified as a BP monitor display",
    )
    bp_monitor_confidence: float | None = Field(
        default=None,
        description="BP monitor classification confidence (0.0-1.0)",
    )


class BPClassifyRequest(BaseModel):
    """Request body for BP monitor image classification."""

    image: str = Field(
        ...,
        description="Base64-encoded image data (with or without data-URL prefix)",
    )


class BPClassifyResponse(BaseModel):
    """Response body for BP monitor image classification."""

    is_bp_monitor: bool = Field(
        description="Whether the image is classified as a BP monitor display"
    )
    confidence: float = Field(
        description="Classification confidence (0.0-1.0)"
    )
    features: dict[str, float] = Field(
        default_factory=dict,
        description="Individual feature scores for debugging",
    )


class HealthResponse(BaseModel):
    """Response body for health check endpoint."""

    status: str = "ok"
    tesseract_available: bool = False
