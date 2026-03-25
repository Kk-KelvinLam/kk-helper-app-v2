"""OCR API endpoint router."""

from fastapi import APIRouter, HTTPException

from backend.models.schemas import (
    BPClassifyRequest,
    BPClassifyResponse,
    BPExtractionRequest,
    BPExtractionResponse,
    OcrRequest,
    OcrResponse,
)
from backend.services import bp_classifier, bp_parser, image_preprocessor, ocr_service

router = APIRouter(prefix="/api/ocr", tags=["OCR"])


@router.post("/extract", response_model=OcrResponse)
async def extract_text(request: OcrRequest) -> OcrResponse:
    """Extract text from an image using OCR.

    Accepts a base64-encoded image and returns the extracted text
    with a confidence score.
    """
    try:
        result = ocr_service.extract_text(
            base64_image=request.image,
            language=request.language,
        )
        return OcrResponse(text=result["text"], confidence=result["confidence"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"OCR processing failed: {exc}"
        ) from exc


@router.post("/bp", response_model=BPExtractionResponse)
async def extract_bp(request: BPExtractionRequest) -> BPExtractionResponse:
    """Extract blood pressure values from a monitor photo.

    Performs the full pipeline:
    1. ML-based image classification (BP monitor detection)
    2. Image preprocessing (contrast enhancement, binarisation)
    3. Dual-pass OCR (full text + digit-only)
    4. BP text parsing (3-strategy extraction)

    Returns structured BP data with systolic, diastolic, heart rate,
    classification result, and metadata.
    """
    try:
        # Step 0: Classify image using ML feature extraction
        classification = bp_classifier.classify_bp_image(request.image)
        is_bp_monitor = classification["is_bp_monitor"]
        bp_monitor_confidence = classification["confidence"]

        # Step 1: Preprocess the image for LCD display OCR
        preprocessed = image_preprocessor.preprocess_bp_image(request.image)

        # Step 2: Dual-pass OCR on the preprocessed image
        ocr_result = ocr_service.extract_text_dual_pass(
            base64_image=preprocessed,
            language=request.language,
        )

        primary_text = ocr_result["text"]
        digit_only_text = ocr_result["digit_only_text"]
        confidence = ocr_result["confidence"]

        # Step 3: If confidence is low, retry with light preprocessing
        if confidence < 60:
            try:
                light_preprocessed = image_preprocessor.preprocess_bp_image_light(
                    request.image
                )
                light_result = ocr_service.extract_text_dual_pass(
                    base64_image=light_preprocessed,
                    language=request.language,
                )
                if light_result["confidence"] > confidence:
                    primary_text = light_result["text"]
                    digit_only_text = light_result["digit_only_text"]
                    confidence = light_result["confidence"]
            except Exception:
                pass  # Light preprocessing failed; continue with existing results

        # Step 4: Parse BP values from OCR text
        parsed = bp_parser.parse_bp_text(primary_text, digit_only_text)

        return BPExtractionResponse(
            systolic=parsed["systolic"],
            diastolic=parsed["diastolic"],
            heart_rate=parsed["heart_rate"],
            strategy=parsed["strategy"],
            irregular_heartbeat=parsed["irregular_heartbeat"],
            raw_text=primary_text,
            digit_only_text=digit_only_text or "",
            confidence=confidence,
            is_bp_monitor=is_bp_monitor,
            bp_monitor_confidence=bp_monitor_confidence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"BP extraction failed: {exc}"
        ) from exc


@router.post("/classify", response_model=BPClassifyResponse)
async def classify_bp(request: BPClassifyRequest) -> BPClassifyResponse:
    """Classify whether an image contains a blood pressure monitor display.

    Uses ML-based feature extraction (LCD tint detection, seven-segment
    pattern analysis, edge density distribution, rectangular display
    detection, and digit-like component counting) to determine if the
    image is of a BP monitor.
    """
    try:
        result = bp_classifier.classify_bp_image(request.image)
        return BPClassifyResponse(
            is_bp_monitor=result["is_bp_monitor"],
            confidence=result["confidence"],
            features=result["features"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Classification failed: {exc}"
        ) from exc
