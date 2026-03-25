"""Image preprocessing service using OpenCV.

Ports the key preprocessing steps from the TypeScript imagePreprocess.ts
pipeline to Python/OpenCV for server-side execution.

Pipeline steps:
1. Decode base64 image
2. Scale up small images
3. Intelligent channel selection (green/blue/white for LCD tint)
4. Contrast stretching with percentile clipping
5. Sharpening (unsharp mask)
6. Adaptive binarisation (local mean thresholding)
7. Morphological closing (fill segment gaps)
8. Inversion check (ensure dark text on white background)
"""

import base64
import re

import cv2
import numpy as np


def decode_base64_image(data: str) -> np.ndarray:
    """Decode a base64-encoded image (with or without data-URL prefix) to an OpenCV image."""
    # Strip data-URL prefix if present (e.g. "data:image/png;base64,...")
    if "," in data:
        data = data.split(",", 1)[1]

    img_bytes = base64.b64decode(data)
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image from base64 data")
    return img


def encode_image_base64(img: np.ndarray, fmt: str = ".png") -> str:
    """Encode an OpenCV image to a base64 string (no data-URL prefix)."""
    _, buffer = cv2.imencode(fmt, img)
    return base64.b64encode(buffer).decode("utf-8")


def scale_up(img: np.ndarray, min_dimension: int = 800) -> np.ndarray:
    """Scale up images that are too small for reliable OCR."""
    h, w = img.shape[:2]
    if max(h, w) >= min_dimension:
        return img
    scale = min_dimension / max(h, w)
    return cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)


def select_channel(img: np.ndarray) -> np.ndarray:
    """Select the best single channel for LCD display OCR.

    LCD displays often have a tinted background (green, blue, orange).
    The channel with the highest contrast (standard deviation) between
    digits and background provides the best OCR input.
    """
    if len(img.shape) == 2:
        return img  # Already grayscale

    b, g, r = cv2.split(img)
    channels = [b, g, r]
    stds = [float(np.std(c)) for c in channels]

    # Pick the channel with the most contrast
    best_idx = int(np.argmax(stds))
    return channels[best_idx]


def contrast_stretch(
    gray: np.ndarray, low_pct: float = 1.0, high_pct: float = 99.0
) -> np.ndarray:
    """Apply percentile-based contrast stretching."""
    low_val = np.percentile(gray, low_pct)
    high_val = np.percentile(gray, high_pct)

    if high_val <= low_val:
        return gray

    stretched = np.clip((gray.astype(np.float32) - low_val) / (high_val - low_val) * 255, 0, 255)
    return stretched.astype(np.uint8)


def sharpen(gray: np.ndarray, sigma: float = 1.0, amount: float = 1.5) -> np.ndarray:
    """Apply unsharp mask sharpening."""
    blurred = cv2.GaussianBlur(gray, (0, 0), sigma)
    sharpened = cv2.addWeighted(gray, 1 + amount, blurred, -amount, 0)
    return np.clip(sharpened, 0, 255).astype(np.uint8)


def adaptive_binarise(gray: np.ndarray, block_pct: float = 0.125) -> np.ndarray:
    """Apply local adaptive thresholding (similar to Bradley's method).

    Uses a window size proportional to the image dimensions to handle
    varying lighting conditions across the LCD display.
    """
    h, w = gray.shape[:2]
    block_size = max(int(max(h, w) * block_pct), 3)
    # Block size must be odd
    if block_size % 2 == 0:
        block_size += 1

    return cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, block_size, 15
    )


def morph_close(binary: np.ndarray, kernel_size: int = 3) -> np.ndarray:
    """Apply morphological closing to fill small gaps in LCD segments."""
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
    return cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)


def check_inversion(binary: np.ndarray) -> np.ndarray:
    """Ensure the image has dark text on white background.

    If more than half the pixels are dark, invert the image.
    """
    white_ratio = np.count_nonzero(binary) / binary.size
    if white_ratio < 0.5:
        return cv2.bitwise_not(binary)
    return binary


def preprocess_bp_image(base64_data: str) -> str:
    """Full preprocessing pipeline for blood pressure monitor images.

    Returns a base64-encoded PNG of the preprocessed binary image.
    """
    img = decode_base64_image(base64_data)
    img = scale_up(img)
    gray = select_channel(img)
    gray = contrast_stretch(gray)
    gray = sharpen(gray)
    binary = adaptive_binarise(gray)
    binary = morph_close(binary)
    binary = check_inversion(binary)
    return encode_image_base64(binary)


def preprocess_bp_image_light(base64_data: str) -> str:
    """Light preprocessing: contrast enhancement without binarisation.

    Used as a fallback when adaptive binarisation destroys information.
    Returns a base64-encoded PNG of the contrast-enhanced grayscale image.
    """
    img = decode_base64_image(base64_data)
    img = scale_up(img)
    gray = select_channel(img)
    gray = contrast_stretch(gray)
    gray = sharpen(gray)
    return encode_image_base64(gray)


def strip_data_url_prefix(data: str) -> str:
    """Remove data-URL prefix if present, returning raw base64."""
    match = re.match(r"^data:[^;]+;base64,", data)
    if match:
        return data[match.end() :]
    return data
