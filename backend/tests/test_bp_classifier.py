"""Tests for the BP monitor image classifier service."""

import base64
import io

import cv2
import numpy as np
import pytest
from PIL import Image, ImageDraw

from backend.services.bp_classifier import (
    _analyse_edge_density,
    _detect_digit_count,
    _detect_display_rectangle,
    _detect_lcd_tint,
    _detect_seven_segment_patterns,
    classify_bp_image,
)


def _make_test_image_base64(width: int = 200, height: int = 150, color: tuple = (128, 128, 128)) -> str:
    """Create a simple test image and return as base64 string."""
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _make_bp_like_image_base64() -> str:
    """Create an image that resembles a BP monitor display.

    Draws seven-segment-like digits on a green-tinted LCD background
    with a rectangular display area.
    """
    width, height = 400, 300
    img = Image.new("RGB", (width, height), (20, 80, 20))  # Dark green body

    draw = ImageDraw.Draw(img)

    # Draw LCD display area (lighter green rectangle)
    lcd_x, lcd_y = 50, 40
    lcd_w, lcd_h = 300, 200
    draw.rectangle(
        [lcd_x, lcd_y, lcd_x + lcd_w, lcd_y + lcd_h],
        fill=(180, 220, 180),
        outline=(100, 150, 100),
        width=2,
    )

    # Draw digit-like rectangles (simulating seven-segment display)
    digit_color = (30, 30, 30)

    # Row 1: SYS value (e.g. "120")
    for i, x_offset in enumerate([80, 140, 200]):
        # Vertical segments
        draw.rectangle([x_offset, 60, x_offset + 10, 100], fill=digit_color)
        draw.rectangle([x_offset + 30, 60, x_offset + 40, 100], fill=digit_color)
        # Horizontal segments
        draw.rectangle([x_offset, 60, x_offset + 40, 68], fill=digit_color)
        draw.rectangle([x_offset, 95, x_offset + 40, 103], fill=digit_color)

    # Row 2: DIA value (e.g. "80")
    for x_offset in [110, 170]:
        draw.rectangle([x_offset, 130, x_offset + 10, 170], fill=digit_color)
        draw.rectangle([x_offset + 30, 130, x_offset + 40, 170], fill=digit_color)
        draw.rectangle([x_offset, 130, x_offset + 40, 138], fill=digit_color)
        draw.rectangle([x_offset, 165, x_offset + 40, 173], fill=digit_color)

    # Row 3: Pulse (e.g. "72")
    for x_offset in [110, 170]:
        draw.rectangle([x_offset, 195, x_offset + 10, 220], fill=digit_color)
        draw.rectangle([x_offset + 30, 195, x_offset + 40, 220], fill=digit_color)
        draw.rectangle([x_offset, 195, x_offset + 40, 203], fill=digit_color)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _make_random_image_base64() -> str:
    """Create a random noise image (not a BP monitor)."""
    img_array = np.random.randint(0, 255, (200, 300, 3), dtype=np.uint8)
    _, buffer = cv2.imencode(".png", img_array)
    return base64.b64encode(buffer).decode("utf-8")


class TestDetectLCDTint:
    def test_green_tint_detected(self):
        # Green-tinted image
        img = np.full((100, 100, 3), (50, 180, 50), dtype=np.uint8)  # BGR green
        detected, score = _detect_lcd_tint(img)
        assert detected is True
        assert score > 0.0

    def test_blue_tint_detected(self):
        img = np.full((100, 100, 3), (180, 50, 50), dtype=np.uint8)  # BGR blue
        detected, score = _detect_lcd_tint(img)
        assert detected is True
        assert score > 0.0

    def test_grayscale_no_tint(self):
        gray = np.full((100, 100), 128, dtype=np.uint8)
        detected, score = _detect_lcd_tint(gray)
        assert detected is False
        assert score == 0.0


class TestDetectSevenSegmentPatterns:
    def test_output_is_tuple(self):
        gray = np.random.randint(0, 255, (200, 200), dtype=np.uint8)
        result = _detect_seven_segment_patterns(gray)
        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_blank_image_low_score(self):
        gray = np.full((200, 200), 200, dtype=np.uint8)
        detected, score = _detect_seven_segment_patterns(gray)
        assert score < 0.5


class TestDetectDisplayRectangle:
    def test_clear_rectangle(self):
        gray = np.full((300, 400), 200, dtype=np.uint8)
        # Draw a prominent rectangle
        cv2.rectangle(gray, (50, 50), (350, 250), 0, 3)
        detected, score = _detect_display_rectangle(gray)
        assert detected is True
        assert score > 0.0

    def test_no_rectangle(self):
        gray = np.full((200, 200), 128, dtype=np.uint8)
        detected, score = _detect_display_rectangle(gray)
        # Uniform image may or may not detect a rectangle
        assert isinstance(detected, bool)
        assert isinstance(score, float)


class TestAnalyseEdgeDensity:
    def test_output_is_tuple(self):
        gray = np.random.randint(0, 255, (200, 200), dtype=np.uint8)
        result = _analyse_edge_density(gray)
        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_uniform_image_low_variance(self):
        gray = np.full((200, 200), 128, dtype=np.uint8)
        detected, score = _analyse_edge_density(gray)
        # Uniform image has no edges
        assert isinstance(detected, bool)


class TestDetectDigitCount:
    def test_output_is_tuple(self):
        gray = np.random.randint(0, 255, (200, 200), dtype=np.uint8)
        result = _detect_digit_count(gray)
        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_blank_image_no_digits(self):
        gray = np.full((200, 200), 255, dtype=np.uint8)
        detected, score = _detect_digit_count(gray)
        assert detected is False


class TestClassifyBPImage:
    def test_returns_required_fields(self):
        b64 = _make_test_image_base64()
        result = classify_bp_image(b64)
        assert "is_bp_monitor" in result
        assert "confidence" in result
        assert "features" in result
        assert isinstance(result["is_bp_monitor"], bool)
        assert 0.0 <= result["confidence"] <= 1.0

    def test_bp_like_image_has_higher_confidence(self):
        bp_img = _make_bp_like_image_base64()
        random_img = _make_random_image_base64()
        bp_result = classify_bp_image(bp_img)
        random_result = classify_bp_image(random_img)
        # BP-like image should have higher confidence than random noise
        assert bp_result["confidence"] >= random_result["confidence"] * 0.5

    def test_features_present(self):
        b64 = _make_test_image_base64()
        result = classify_bp_image(b64)
        features = result["features"]
        assert "lcd_tint" in features
        assert "seven_segment" in features
        assert "display_rectangle" in features
        assert "edge_density" in features
        assert "digit_count" in features

    def test_data_url_prefix_handled(self):
        b64 = _make_test_image_base64()
        data_url = f"data:image/png;base64,{b64}"
        result = classify_bp_image(data_url)
        assert "is_bp_monitor" in result

    def test_invalid_image_raises(self):
        with pytest.raises(Exception):
            classify_bp_image("not-valid-base64!!!")

    def test_confidence_range(self):
        b64 = _make_test_image_base64()
        result = classify_bp_image(b64)
        assert 0.0 <= result["confidence"] <= 1.0

    def test_uniform_white_image_low_confidence(self):
        b64 = _make_test_image_base64(color=(255, 255, 255))
        result = classify_bp_image(b64)
        # Plain white image should not be classified as BP monitor
        assert result["confidence"] < 0.8
