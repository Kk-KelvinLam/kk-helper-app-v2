/**
 * API client for the Python OCR backend service.
 *
 * Provides functions to call the backend for image data extraction,
 * with automatic fallback to client-side Tesseract.js when the backend
 * is unavailable.
 */

/** Base URL for the OCR backend API. Configured via environment variable. */
const OCR_API_URL = import.meta.env.VITE_OCR_API_URL as string | undefined;

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
  if (!OCR_API_URL) return false;

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
  if (!OCR_API_URL) {
    throw new Error('OCR backend URL not configured');
  }

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
  if (!OCR_API_URL) {
    throw new Error('OCR backend URL not configured');
  }

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
