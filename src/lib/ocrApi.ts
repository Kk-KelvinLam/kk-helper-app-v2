/**
 * API client for the Python OCR backend service.
 *
 * Provides functions to call the backend for image data extraction,
 * with automatic fallback to client-side Tesseract.js when the backend
 * is unavailable.
 */

/** localStorage key for the user-configured backend API URL. */
export const CUSTOM_API_URL_STORAGE_KEY = 'kk-helper-custom-api-url';

/**
 * Build-time default for the OCR backend API base URL.
 *
 * When {@link VITE_OCR_API_URL} is set (e.g. `http://localhost:8000` during
 * local development), that value is used as the default.
 *
 * When it is **not** set (typical production deploy), an empty string is used
 * so that requests go to the same origin.  Firebase Hosting rewrites
 * `/api/**` to the Cloud Run backend service, making this work transparently.
 */
const BUILD_TIME_API_URL: string = (import.meta.env.VITE_OCR_API_URL as string | undefined) ?? '';

/**
 * Return the effective backend API base URL.
 *
 * Priority order:
 * 1. User-configured URL saved in localStorage (runtime override).
 * 2. Build-time {@link VITE_OCR_API_URL} environment variable.
 * 3. Empty string → same-origin requests (Firebase Hosting rewrites /api/**).
 */
export function getApiBaseUrl(): string {
  try {
    const stored = localStorage.getItem(CUSTOM_API_URL_STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim();
  } catch {
    // localStorage not available
  }
  return BUILD_TIME_API_URL;
}

/**
 * Persist a custom backend API URL to localStorage.
 * Pass an empty string (or whitespace-only) to revert to the default.
 */
export function setCustomApiUrl(url: string): void {
  try {
    const trimmed = url.trim();
    if (trimmed) {
      localStorage.setItem(CUSTOM_API_URL_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(CUSTOM_API_URL_STORAGE_KEY);
    }
  } catch {
    // localStorage not available
  }
}

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

    const response = await fetch(`${getApiBaseUrl()}/api/health`, {
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
    const response = await fetch(`${getApiBaseUrl()}/api/ocr/extract`, {
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
    const response = await fetch(`${getApiBaseUrl()}/api/ocr/bp`, {
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
    const response = await fetch(`${getApiBaseUrl()}/api/ocr/classify`, {
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
