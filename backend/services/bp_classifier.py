"""BP monitor image classifier using OpenCV feature extraction.

Applies machine learning techniques (feature engineering + weighted scoring)
to determine whether an image contains a blood pressure monitor display.

Features extracted:
1. LCD color tint detection (green/blue/white/orange backgrounds)
2. Seven-segment digit pattern detection via morphological analysis
3. Edge density distribution for display region identification
4. Rectangular contour detection for screen area
5. Aspect ratio and structural analysis
"""

import cv2
import numpy as np

from backend.services.image_preprocessor import decode_base64_image


# Classification thresholds
BP_MONITOR_THRESHOLD = 0.45  # Minimum score to classify as BP monitor


def _detect_lcd_tint(img: np.ndarray) -> tuple[bool, float]:
    """Detect LCD display color tint characteristic of BP monitors.

    BP monitor LCDs typically have green, blue, or white-lit backgrounds.
    Returns (detected, score) where score indicates tint strength.
    """
    if len(img.shape) < 3:
        return False, 0.0

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)

    height, width = img.shape[:2]
    total_pixels = height * width

    # Green tint (common in LCD displays): H=35-85
    green_mask = cv2.inRange(hsv, (35, 30, 50), (85, 255, 255))
    green_ratio = np.count_nonzero(green_mask) / total_pixels

    # Blue tint: H=90-130
    blue_mask = cv2.inRange(hsv, (90, 30, 50), (130, 255, 255))
    blue_ratio = np.count_nonzero(blue_mask) / total_pixels

    # White/bright (backlit displays): high V, low S
    white_mask = cv2.inRange(hsv, (0, 0, 180), (180, 40, 255))
    white_ratio = np.count_nonzero(white_mask) / total_pixels

    # Orange/amber tint: H=10-25
    orange_mask = cv2.inRange(hsv, (10, 30, 50), (25, 255, 255))
    orange_ratio = np.count_nonzero(orange_mask) / total_pixels

    dominant = max(green_ratio, blue_ratio, white_ratio, orange_ratio)

    # LCD displays often have a dominant tint covering >15% of the image
    detected = bool(dominant > 0.15)
    score = float(min(dominant / 0.4, 1.0))  # Normalise to 0-1

    return detected, score


def _detect_seven_segment_patterns(gray: np.ndarray) -> tuple[bool, float]:
    """Detect seven-segment digit patterns via morphological analysis.

    Seven-segment displays have characteristic horizontal and vertical
    line segments that form digits. This function uses directional
    morphological operations to detect these patterns.
    """
    # Adaptive threshold to isolate display elements
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV,
        max(gray.shape[0] // 8 | 1, 3), 10
    )

    h, w = gray.shape[:2]
    seg_len = max(w // 20, 5)

    # Detect horizontal segments (top, middle, bottom bars of digits)
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (seg_len, 1))
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN, h_kernel)
    h_count = cv2.countNonZero(horizontal)

    # Detect vertical segments (left/right bars of digits)
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, seg_len))
    vertical = cv2.morphologyEx(binary, cv2.MORPH_OPEN, v_kernel)
    v_count = cv2.countNonZero(vertical)

    total_pixels = h * w
    h_ratio = h_count / total_pixels
    v_ratio = v_count / total_pixels

    # Seven-segment displays have balanced horizontal and vertical segments
    segment_ratio = (h_ratio + v_ratio) / 2
    balance = 1.0 - abs(h_ratio - v_ratio) / max(h_ratio + v_ratio, 1e-6)

    # Both types of segments must be present with reasonable balance
    detected = bool(h_ratio > 0.01 and v_ratio > 0.01 and balance > 0.3)
    score = float(min(segment_ratio / 0.05, 1.0) * balance)

    return detected, score


def _detect_display_rectangle(gray: np.ndarray) -> tuple[bool, float]:
    """Detect rectangular LCD display region via contour analysis.

    BP monitors have a rectangular display area that can be identified
    by finding large rectangular contours in the image.
    """
    # Edge detection
    edges = cv2.Canny(gray, 50, 150)

    # Dilate to close gaps in contours
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    h, w = gray.shape[:2]
    image_area = h * w

    best_rect_score = 0.0

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < image_area * 0.05:  # Too small
            continue

        # Approximate contour to polygon
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.04 * peri, True)

        # Look for quadrilaterals (rectangular displays)
        if 4 <= len(approx) <= 6:
            # Check aspect ratio — BP displays are typically wider than tall
            x, y, rw, rh = cv2.boundingRect(approx)
            aspect = rw / max(rh, 1)
            area_ratio = area / image_area

            # Typical BP display aspect ratio: 1.2 to 4.0
            if 0.8 <= aspect <= 5.0 and area_ratio > 0.05:
                rect_score = min(area_ratio / 0.3, 1.0) * (1.0 if 1.2 <= aspect <= 4.0 else 0.5)
                best_rect_score = max(best_rect_score, rect_score)

    detected = bool(best_rect_score > 0.2)
    return detected, float(best_rect_score)


def _analyse_edge_density(gray: np.ndarray) -> tuple[bool, float]:
    """Analyse edge density distribution characteristic of BP displays.

    BP monitor displays have concentrated edge density in the digit area
    (high edge density) with a relatively uniform background (low density).
    This contrast between display and non-display regions is characteristic.
    """
    edges = cv2.Canny(gray, 50, 150)
    h, w = edges.shape[:2]

    # Split image into a grid and analyse edge density distribution
    rows, cols = 4, 4
    cell_h, cell_w = h // rows, w // cols

    densities = []
    for r in range(rows):
        for c in range(cols):
            cell = edges[r * cell_h:(r + 1) * cell_h, c * cell_w:(c + 1) * cell_w]
            density = np.count_nonzero(cell) / cell.size
            densities.append(density)

    densities_arr = np.array(densities)

    # BP displays have high variance in edge density (some cells with digits,
    # some with empty background)
    density_std = float(np.std(densities_arr))
    density_mean = float(np.mean(densities_arr))

    # Coefficient of variation — high CV indicates concentrated edge regions
    cv = density_std / max(density_mean, 1e-6)

    # Overall edge density should be moderate (not too sparse, not too dense)
    moderate_density = 0.02 < density_mean < 0.3

    detected = bool(cv > 0.4 and moderate_density)
    score = float(min(cv / 1.5, 1.0) * (1.0 if moderate_density else 0.3))

    return detected, score


def _detect_digit_count(gray: np.ndarray) -> tuple[bool, float]:
    """Detect whether the image contains digit-like connected components.

    BP monitors display 2-3 rows of large digits. This function counts
    connected components with digit-like aspect ratios and sizes.
    """
    # Binarise
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Find connected components
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)

    h, w = gray.shape[:2]
    image_area = h * w

    digit_candidates = 0
    for i in range(1, num_labels):  # Skip background
        comp_w = stats[i, cv2.CC_STAT_WIDTH]
        comp_h = stats[i, cv2.CC_STAT_HEIGHT]
        comp_area = stats[i, cv2.CC_STAT_AREA]

        # Digit-like properties
        aspect = comp_h / max(comp_w, 1)
        area_ratio = comp_area / image_area

        # Digits are taller than wide (aspect > 1) and have moderate size
        if 1.0 <= aspect <= 5.0 and 0.002 < area_ratio < 0.15:
            digit_candidates += 1

    # BP monitors typically show 6-12 digit-like components (3 values × 2-3 digits each)
    detected = bool(3 <= digit_candidates <= 30)
    score = float(min(digit_candidates / 8.0, 1.0) if detected else digit_candidates / 20.0)

    return detected, score


def classify_bp_image(base64_data: str) -> dict:
    """Classify whether an image contains a blood pressure monitor display.

    Uses multiple feature extraction techniques and combines them with
    weighted scoring to produce a classification result.

    Args:
        base64_data: Base64-encoded image data (with or without data-URL prefix).

    Returns:
        Dictionary with:
        - is_bp_monitor (bool): Whether the image is classified as a BP monitor
        - confidence (float): Classification confidence (0.0 to 1.0)
        - features (dict): Individual feature scores for debugging
    """
    img = decode_base64_image(base64_data)

    # Convert to grayscale for feature extraction
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img

    # Extract features
    lcd_detected, lcd_score = _detect_lcd_tint(img)
    segment_detected, segment_score = _detect_seven_segment_patterns(gray)
    rect_detected, rect_score = _detect_display_rectangle(gray)
    edge_detected, edge_score = _analyse_edge_density(gray)
    digit_detected, digit_score = _detect_digit_count(gray)

    # Weighted combination of feature scores
    # Weights reflect the discriminative power of each feature
    weights = {
        "lcd_tint": 0.15,
        "seven_segment": 0.30,
        "display_rectangle": 0.15,
        "edge_density": 0.15,
        "digit_count": 0.25,
    }

    scores = {
        "lcd_tint": lcd_score,
        "seven_segment": segment_score,
        "display_rectangle": rect_score,
        "edge_density": edge_score,
        "digit_count": digit_score,
    }

    overall_confidence = sum(weights[k] * scores[k] for k in weights)

    # Bonus: if multiple strong signals are present, boost confidence
    strong_signals = sum(1 for s in scores.values() if s > 0.5)
    if strong_signals >= 3:
        overall_confidence = min(overall_confidence * 1.15, 1.0)

    is_bp_monitor = overall_confidence >= BP_MONITOR_THRESHOLD

    return {
        "is_bp_monitor": bool(is_bp_monitor),
        "confidence": round(float(overall_confidence), 3),
        "features": {k: round(float(v), 3) for k, v in scores.items()},
    }
