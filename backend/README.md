# KK Helper OCR Backend

Python-based backend service for server-side image data extraction, replacing
the client-side Tesseract.js implementation with a more powerful OpenCV +
pytesseract pipeline.

## Architecture

```
backend/
├── main.py                  # FastAPI application entry point
├── config.py                # Environment-based configuration
├── Dockerfile               # Container build for deployment
├── requirements.txt         # Python dependencies
├── api/
│   └── ocr.py               # REST API endpoint router
├── models/
│   └── schemas.py           # Pydantic request/response models
├── services/
│   ├── image_preprocessor.py  # OpenCV image preprocessing pipeline
│   ├── ocr_service.py        # pytesseract OCR extraction
│   └── bp_parser.py          # Blood pressure text parsing
└── tests/
    ├── test_bp_parser.py      # BP parser unit tests
    ├── test_image_preprocessor.py  # Image preprocessing tests
    └── test_api.py            # API endpoint tests
```

## API Endpoints

| Method | Path              | Description                                    |
|--------|-------------------|------------------------------------------------|
| GET    | `/api/health`     | Health check — verifies Tesseract availability |
| POST   | `/api/ocr/extract`| General OCR text extraction                    |
| POST   | `/api/ocr/bp`     | Blood pressure extraction (preprocess + OCR + parse) |

### `POST /api/ocr/extract`

Extract text from any image.

**Request:**
```json
{
  "image": "<base64-encoded image>",
  "language": "eng"
}
```

**Response:**
```json
{
  "text": "extracted text here",
  "confidence": 85.5
}
```

### `POST /api/ocr/bp`

Full blood pressure extraction pipeline: preprocesses the image for LCD
display OCR, runs dual-pass OCR (full text + digit-only), and parses BP
values using a 3-strategy extraction algorithm.

**Request:**
```json
{
  "image": "<base64-encoded image>",
  "language": "eng+chi_tra+chi_sim"
}
```

**Response:**
```json
{
  "systolic": "120",
  "diastolic": "80",
  "heart_rate": "72",
  "strategy": 1,
  "irregular_heartbeat": false,
  "raw_text": "SYS 120 mmHg DIA 80 mmHg PUL 72 /min",
  "digit_only_text": "120 80 72",
  "confidence": 87.3
}
```

## Setup

### Prerequisites

- Python 3.12+
- Tesseract OCR (`apt-get install tesseract-ocr`)
- Tesseract language data: `tesseract-ocr-eng`, `tesseract-ocr-chi-tra`, `tesseract-ocr-chi-sim`

### Local Development

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn backend.main:app --reload --port 8000
```

### Docker

```bash
# Build
docker build -t kk-helper-ocr-backend ./backend

# Run
docker run -p 8000:8000 kk-helper-ocr-backend
```

### Running Tests

```bash
# From the project root
cd backend
pytest tests/ -v
```

## Environment Variables

| Variable          | Default                                         | Description                         |
|-------------------|--------------------------------------------------|-------------------------------------|
| `CORS_ORIGINS`    | `http://localhost:5173,http://localhost:4173`     | Comma-separated allowed origins     |
| `TESSERACT_CMD`   | *(auto-detect)*                                  | Path to Tesseract binary            |
| `MAX_IMAGE_SIZE`  | `10485760` (10 MB)                               | Maximum image upload size in bytes  |

## Image Preprocessing Pipeline

The Python backend replicates and enhances the TypeScript preprocessing
pipeline using OpenCV:

1. **Scale up** — Enlarge small images for better OCR resolution
2. **Channel selection** — Pick the channel with highest contrast (LCD tint compensation)
3. **Contrast stretching** — Percentile-based normalization
4. **Sharpening** — Unsharp mask to restore blurry LCD segment edges
5. **Adaptive binarisation** — Local mean thresholding (handles uneven lighting)
6. **Morphological closing** — Fill gaps in LCD digit segments
7. **Inversion check** — Ensure dark text on white background

## BP Parsing Strategies

1. **Strategy 1 — Labeled patterns** (most reliable):
   - English labels: `SYS 120 DIA 80 PUL 72`
   - Chinese labels: `收縮壓 120 舒張壓 80 脈搏 72`
   - Reversed order: `114 高壓 75 低壓`

2. **Strategy 2 — Slash format**: `120/80`, `120/80 72BPM`

3. **Strategy 3 — Numbers only**: Positional or sorted extraction of
   standalone 2-3 digit numbers in valid physiological ranges

Includes seven-segment display (SSD) character correction for common
OCR misreads (b→6, Z→2, S→5, B→8, etc.).
