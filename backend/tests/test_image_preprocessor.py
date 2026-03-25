"""Tests for the image preprocessor service."""

import base64
import io

import numpy as np
import pytest
from PIL import Image

from backend.services.image_preprocessor import (
    adaptive_binarise,
    check_inversion,
    contrast_stretch,
    decode_base64_image,
    encode_image_base64,
    morph_close,
    scale_up,
    select_channel,
    sharpen,
    strip_data_url_prefix,
)


def _make_test_image(width: int = 100, height: int = 100, color: tuple = (128, 128, 128)) -> str:
    """Create a simple test image and return as base64 string."""
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _make_test_image_data_url(width: int = 100, height: int = 100) -> str:
    """Create a test image with data-URL prefix."""
    b64 = _make_test_image(width, height)
    return f"data:image/png;base64,{b64}"


class TestDecodeBase64Image:
    def test_plain_base64(self):
        b64 = _make_test_image()
        img = decode_base64_image(b64)
        assert img is not None
        assert img.shape[0] == 100
        assert img.shape[1] == 100

    def test_data_url(self):
        data_url = _make_test_image_data_url()
        img = decode_base64_image(data_url)
        assert img is not None
        assert img.shape[0] == 100

    def test_invalid_base64(self):
        with pytest.raises(Exception):
            decode_base64_image("not-valid-base64!!!")


class TestEncodeImageBase64:
    def test_roundtrip(self):
        original = np.zeros((50, 50, 3), dtype=np.uint8)
        b64 = encode_image_base64(original)
        decoded = decode_base64_image(b64)
        assert decoded.shape[:2] == (50, 50)


class TestScaleUp:
    def test_small_image_scaled(self):
        small = np.zeros((100, 100, 3), dtype=np.uint8)
        result = scale_up(small, min_dimension=200)
        assert max(result.shape[:2]) >= 200

    def test_large_image_unchanged(self):
        large = np.zeros((800, 800, 3), dtype=np.uint8)
        result = scale_up(large, min_dimension=800)
        assert result.shape == large.shape


class TestSelectChannel:
    def test_grayscale_passthrough(self):
        gray = np.zeros((100, 100), dtype=np.uint8)
        result = select_channel(gray)
        assert result.shape == (100, 100)

    def test_color_returns_single_channel(self):
        color = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
        result = select_channel(color)
        assert len(result.shape) == 2


class TestContrastStretch:
    def test_output_range(self):
        gray = np.random.randint(50, 200, (100, 100), dtype=np.uint8)
        result = contrast_stretch(gray)
        assert result.min() >= 0
        assert result.max() <= 255


class TestSharpen:
    def test_output_same_shape(self):
        gray = np.random.randint(0, 255, (100, 100), dtype=np.uint8)
        result = sharpen(gray)
        assert result.shape == gray.shape


class TestAdaptiveBinarise:
    def test_output_binary(self):
        gray = np.random.randint(0, 255, (200, 200), dtype=np.uint8)
        result = adaptive_binarise(gray)
        unique_vals = set(np.unique(result))
        assert unique_vals.issubset({0, 255})


class TestMorphClose:
    def test_output_same_shape(self):
        binary = np.random.choice([0, 255], (100, 100)).astype(np.uint8)
        result = morph_close(binary)
        assert result.shape == binary.shape


class TestCheckInversion:
    def test_mostly_dark_gets_inverted(self):
        dark = np.zeros((100, 100), dtype=np.uint8)
        result = check_inversion(dark)
        assert result.mean() > 127

    def test_mostly_light_stays(self):
        light = np.full((100, 100), 255, dtype=np.uint8)
        result = check_inversion(light)
        assert result.mean() > 127


class TestStripDataUrlPrefix:
    def test_with_prefix(self):
        result = strip_data_url_prefix("data:image/png;base64,abc123")
        assert result == "abc123"

    def test_without_prefix(self):
        result = strip_data_url_prefix("abc123")
        assert result == "abc123"
