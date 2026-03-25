"""OCR service using pytesseract for server-side text extraction."""

import base64
import tempfile
from pathlib import Path

import pytesseract
from PIL import Image
import io

from backend.config import TESSERACT_CMD


if TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD


def _image_from_base64(data: str) -> Image.Image:
    """Convert base64-encoded image data to a PIL Image."""
    # Strip data-URL prefix if present
    if "," in data:
        data = data.split(",", 1)[1]

    img_bytes = base64.b64decode(data)
    return Image.open(io.BytesIO(img_bytes))


def extract_text(
    base64_image: str,
    language: str = "eng",
    psm: int = 6,
    char_whitelist: str | None = None,
) -> dict:
    """Run OCR on a base64-encoded image and return extracted text + confidence.

    Args:
        base64_image: Base64-encoded image data (with or without data-URL prefix).
        language: Tesseract language string (e.g. "eng", "eng+chi_tra+chi_sim").
        psm: Page segmentation mode (default 6 = single uniform block of text).
        char_whitelist: Optional character whitelist for restricted recognition.

    Returns:
        dict with 'text' (str) and 'confidence' (float 0-100).
    """
    img = _image_from_base64(base64_image)

    config_parts = [f"--psm {psm}"]
    if char_whitelist:
        config_parts.append(f"-c tessedit_char_whitelist={char_whitelist}")
    config = " ".join(config_parts)

    # Get detailed output for confidence score
    data = pytesseract.image_to_data(img, lang=language, config=config, output_type=pytesseract.Output.DICT)

    # Calculate mean confidence from non-empty words
    confidences = [
        float(c)
        for c, text in zip(data["conf"], data["text"])
        if str(c) != "-1" and str(text).strip()
    ]
    mean_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    # Extract full text
    text = pytesseract.image_to_string(img, lang=language, config=config).strip()

    return {"text": text, "confidence": mean_confidence}


def extract_text_dual_pass(
    base64_image: str,
    language: str = "eng",
    psm: int = 6,
) -> dict:
    """Run dual-pass OCR: primary (full language) + digit-only pass.

    The digit-only pass uses a character whitelist restricted to '0123456789'
    which prevents seven-segment LCD digit misreads (e.g. 5→S, 6→b, 8→B).

    Args:
        base64_image: Base64-encoded image data.
        language: Tesseract language string for the primary pass.
        psm: Page segmentation mode.

    Returns:
        dict with 'text', 'digit_only_text', and 'confidence'.
    """
    # Primary pass: full language support
    primary = extract_text(base64_image, language=language, psm=psm)

    # Secondary pass: digit-only (language-independent)
    digit = extract_text(
        base64_image,
        language="eng",
        psm=psm,
        char_whitelist="0123456789",
    )

    return {
        "text": primary["text"],
        "digit_only_text": digit["text"],
        "confidence": primary["confidence"],
    }


def is_tesseract_available() -> bool:
    """Check whether the Tesseract binary is accessible."""
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False
