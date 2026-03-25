/**
 * Utility helpers for combining individual BP OCR readings into a single
 * structured blood-pressure record.
 *
 * @module bpOcrUtils
 */

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

/** A fully resolved blood-pressure reading from OCR. */
export interface BPReading {
  /** Systolic pressure in mmHg (top number). */
  systolic: number;
  /** Diastolic pressure in mmHg (bottom number). */
  diastolic: number;
  /** Heart rate / pulse in bpm (optional — not all models output this). */
  pulse: number | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Combine utility
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Combine individually predicted SYS, DIA, and optional Pulse values into
 * a single {@link BPReading} object.
 *
 * This is useful when the user uploads separate cropped images for each
 * reading and the CNN model returns one value per image.
 *
 * @param systolic  - Predicted systolic value (0–999)
 * @param diastolic - Predicted diastolic value (0–999)
 * @param pulse     - Predicted pulse value, or `null` if not available
 * @returns A validated {@link BPReading}
 * @throws {Error} If systolic or diastolic values are out of range
 *
 * @example
 * ```ts
 * const bp = combineBPReadings(120, 80, 72);
 * // { systolic: 120, diastolic: 80, pulse: 72 }
 * ```
 */
export function combineBPReadings(
  systolic: number,
  diastolic: number,
  pulse: number | null = null,
): BPReading {
  if (systolic < 0 || systolic > 999) {
    throw new Error(`Systolic value out of range: ${systolic}`);
  }
  if (diastolic < 0 || diastolic > 999) {
    throw new Error(`Diastolic value out of range: ${diastolic}`);
  }
  if (pulse !== null && (pulse < 0 || pulse > 999)) {
    throw new Error(`Pulse value out of range: ${pulse}`);
  }

  return { systolic, diastolic, pulse };
}

/**
 * Check whether a {@link BPReading} has physiologically plausible values.
 *
 * Basic sanity checks:
 * - Systolic should be greater than diastolic.
 * - Systolic between 60 and 300 mmHg.
 * - Diastolic between 30 and 200 mmHg.
 * - Pulse (if present) between 30 and 250 bpm.
 *
 * @param reading - The BP reading to validate
 * @returns `true` if the reading passes all plausibility checks
 */
export function isPlausibleBPReading(reading: BPReading): boolean {
  const { systolic, diastolic, pulse } = reading;

  if (systolic <= diastolic) return false;
  if (systolic < 60 || systolic > 300) return false;
  if (diastolic < 30 || diastolic > 200) return false;
  if (pulse !== null && (pulse < 30 || pulse > 250)) return false;

  return true;
}
