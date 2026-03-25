/**
 * API client for the Python OCR backend service.
 *
 * Provides functions to call the backend for image data extraction,
 * with automatic fallback to client-side Tesseract.js when the backend
 * is unavailable.
 */

/**
 * Base URL for the OCR backend API.
 *
 * When {@link VITE_OCR_API_URL} is set (e.g. `http://localhost:8000` during
 * local development), requests are sent to that absolute URL.
 *
 * When it is **not** set (typical production deploy), an empty string is used
 * so that requests go to the same origin.  Firebase Hosting rewrites
 * `/api/**` to the Cloud Run backend service, making this work transparently.
 */
const OCR_API_URL: string = (import.meta.env.VITE_OCR_API_URL as string | undefined) ?? '';

/** Timeout in milliseconds for backend API requests. */
const API_TIMEOUT_MS = 30_000;

/** Response from the general OCR extraction endpoint. */
export interface OcrApiResponse {
  text: string;
  confidence: number;
}

/** Response from the blood pressure extraction endpoint. */
export interface BPExtractionApiResponse {
  systolic: string;
  diastolic: string;
  heart_rate: string;
  strategy: number | null;
  irregular_heartbeat: boolean | null;
  raw_text: string;
  digit_only_text: string;
  confidence: number;
  /** Whether the image was classified as a BP monitor display. */
  is_bp_monitor: boolean | null;
  /** BP monitor classification confidence (0.0–1.0). */
  bp_monitor_confidence: number | null;
}

/** Response from the BP image classification endpoint. */
export interface BPClassifyApiResponse {
  is_bp_monitor: boolean;
  confidence: number;
  features: Record<string, number>;
}

/** Health check response from the backend. */
interface HealthResponse {
  status: string;
  tesseract_available: boolean;
}

/**
 * Check whether the OCR backend is configured and available.
 */
export async function isBackendAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${OCR_API_URL}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return false;

    const data: HealthResponse = await response.json();
    return data.status === 'ok' && data.tesseract_available;
  } catch {
    return false;
  }
}

/**
 * Extract text from an image using the backend OCR service.
 *
 * @param imageDataUrl - Base64-encoded image (with or without data-URL prefix)
 * @param language - Tesseract language string (default: 'eng')
 * @returns Extracted text and confidence score
 * @throws Error if the backend is unavailable or request fails
 */
export async function extractTextFromBackend(
  imageDataUrl: string,
  language: string = 'eng',
): Promise<OcrApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${OCR_API_URL}/api/ocr/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageDataUrl, language }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        (errorData as { detail?: string }).detail || `Backend OCR failed with status ${response.status}`,
      );
    }

    return (await response.json()) as OcrApiResponse;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Extract blood pressure values from a monitor photo using the backend.
 *
 * The backend performs the full pipeline: image preprocessing → dual-pass
 * OCR → BP text parsing, returning structured data.
 *
 * @param imageDataUrl - Base64-encoded image of the BP monitor
 * @param language - Tesseract language string (default: 'eng+chi_tra+chi_sim')
 * @returns Structured BP extraction result
 * @throws Error if the backend is unavailable or request fails
 */
export async function extractBPFromBackend(
  imageDataUrl: string,
  language: string = 'eng+chi_tra+chi_sim',
): Promise<BPExtractionApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${OCR_API_URL}/api/ocr/bp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageDataUrl, language }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        (errorData as { detail?: string }).detail || `Backend BP extraction failed with status ${response.status}`,
      );
    }

    return (await response.json()) as BPExtractionApiResponse;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Classify whether an image contains a blood pressure monitor display.
 *
 * Uses ML-based feature extraction on the backend to determine if the
 * image is of a BP monitor, returning a classification result with
 * confidence score and individual feature scores.
 *
 * @param imageDataUrl - Base64-encoded image of the potential BP monitor
 * @returns Classification result with confidence and features
 * @throws Error if the backend is unavailable or request fails
 */
export async function classifyBPImage(
  imageDataUrl: string,
): Promise<BPClassifyApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${OCR_API_URL}/api/ocr/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageDataUrl }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        (errorData as { detail?: string }).detail || `Backend classification failed with status ${response.status}`,
      );
    }

    return (await response.json()) as BPClassifyApiResponse;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
