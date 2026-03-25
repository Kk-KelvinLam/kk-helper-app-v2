"""Tests for the OCR API endpoints."""

import base64
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


def _make_test_image_base64() -> str:
    """Create a simple test image as base64."""
    img = Image.new("RGB", (100, 100), (255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


class TestHealthEndpoint:
    def test_health_check(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "tesseract_available" in data


class TestExtractEndpoint:
    def test_invalid_image(self, client):
        response = client.post(
            "/api/ocr/extract",
            json={"image": "not-valid-base64!!!", "language": "eng"},
        )
        assert response.status_code in (400, 500)

    def test_missing_image(self, client):
        response = client.post("/api/ocr/extract", json={"language": "eng"})
        assert response.status_code == 422  # Validation error


class TestBPEndpoint:
    def test_invalid_image(self, client):
        response = client.post(
            "/api/ocr/bp",
            json={"image": "not-valid-base64!!!", "language": "eng"},
        )
        assert response.status_code in (400, 500)

    def test_missing_image(self, client):
        response = client.post("/api/ocr/bp", json={"language": "eng"})
        assert response.status_code == 422  # Validation error
