/**
 * Image preprocessing utilities for improving OCR accuracy on BP monitor
 * LCD/LED segment displays.
 *
 * LCD segment digits have specific visual characteristics (large, segmented,
 * on a greenish/grey background) that confuse general-purpose OCR.
 * Preprocessing converts the image to a high-contrast black-on-white bitmap
 * so Tesseract can recognise the text more reliably.
 *
 * Pipeline (v2 — improved for LCD 7-segment displays):
 * 1. Scale up small images for better OCR resolution.
 * 2. Extract the green channel (best contrast for green-tinted LCD panels).
 * 3. Contrast stretching with percentile clipping (robust to outliers).
 * 4. Adaptive binarisation via Otsu's method.
 * 5. Morphological closing (dilate → erode) to fill segment gaps.
 * 6. Inversion check — ensure dark text on white background.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single step in the preprocessing pipeline, for debug visualisation. */
export interface PreprocessingStep {
  label: string;
  dataUrl: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Preprocess a BP-monitor photo for OCR.
 * Returns only the final processed image as a PNG data-URL.
 */
export async function preprocessBPImage(dataUrl: string): Promise<string> {
  const { result } = await preprocessBPImageCore(dataUrl, false);
  return result;
}

/**
 * Preprocess a BP-monitor photo for OCR **with** intermediate step images.
 * Used in testing mode to visualise each preprocessing stage.
 */
export async function preprocessBPImageWithSteps(dataUrl: string): Promise<{
  result: string;
  steps: PreprocessingStep[];
}> {
  return preprocessBPImageCore(dataUrl, true);
}

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

/** Minimum width (px) before scaling up — Tesseract benefits from higher res. */
const MIN_WIDTH = 800;

async function preprocessBPImageCore(
  dataUrl: string,
  collectSteps: boolean,
): Promise<{ result: string; steps: PreprocessingStep[] }> {
  const steps: PreprocessingStep[] = [];
  const img = await loadImage(dataUrl);

  // Scale up small images for better OCR accuracy
  const scale = img.width < MIN_WIDTH ? Math.ceil(MIN_WIDTH / img.width) : 1;
  const width = img.width * scale;
  const height = img.height * scale;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { result: dataUrl, steps: [] };

  // Use nearest-neighbour for integer scaling (keeps LCD segments crisp)
  ctx.imageSmoothingEnabled = scale <= 2;
  ctx.drawImage(img, 0, 0, width, height);

  if (collectSteps) {
    steps.push({ label: 'Original', dataUrl: canvas.toDataURL('image/png') });
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  // --- Step 1: Green channel extraction ---
  // LCD panels are typically green-tinted; the green channel provides the best
  // contrast between the bright background and dark digit segments.
  for (let i = 0; i < data.length; i += 4) {
    const green = data[i + 1];
    data[i] = data[i + 1] = data[i + 2] = green;
  }

  if (collectSteps) {
    ctx.putImageData(imageData, 0, 0);
    steps.push({ label: 'Green Channel', dataUrl: canvas.toDataURL('image/png') });
  }

  // --- Step 2: Contrast stretching with percentile clipping ---
  applyContrastStretch(data, 1);

  if (collectSteps) {
    ctx.putImageData(imageData, 0, 0);
    steps.push({ label: 'Contrast Stretched', dataUrl: canvas.toDataURL('image/png') });
  }

  // --- Step 3: Otsu's adaptive binarisation ---
  const threshold = computeOtsuThreshold(data);
  for (let i = 0; i < data.length; i += 4) {
    const bw = data[i] < threshold ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = bw;
  }

  if (collectSteps) {
    ctx.putImageData(imageData, 0, 0);
    steps.push({ label: `Binarised (Otsu t=${threshold})`, dataUrl: canvas.toDataURL('image/png') });
  }

  // --- Step 4: Morphological closing (dilate then erode, 3×3 kernel) ---
  // Fills tiny gaps between LCD segments so digits appear solid to Tesseract.
  morphDilate(data, width, height);
  morphErode(data, width, height);

  if (collectSteps) {
    ctx.putImageData(imageData, 0, 0);
    steps.push({ label: 'Morph. Closing', dataUrl: canvas.toDataURL('image/png') });
  }

  // --- Step 5: Inversion check ---
  // Tesseract expects dark text on a white background.  If more than half the
  // pixels are dark, the polarity is wrong and we invert.
  let darkCount = 0;
  const totalPixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === 0) darkCount++;
  }
  if (darkCount > totalPixels * 0.5) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = 255 - data[i];
    }
    if (collectSteps) {
      ctx.putImageData(imageData, 0, 0);
      steps.push({ label: 'Inverted', dataUrl: canvas.toDataURL('image/png') });
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const result = canvas.toDataURL('image/png');

  if (collectSteps) {
    steps.push({ label: 'Final', dataUrl: result });
  }

  return { result, steps };
}

// ---------------------------------------------------------------------------
// Image processing helpers
// ---------------------------------------------------------------------------

/**
 * Contrast stretching with percentile clipping.
 * Ignoring the extreme `clipPercent`% of pixels on each end avoids a single
 * bright/dark pixel from dominating the histogram range.
 */
function applyContrastStretch(data: Uint8ClampedArray, clipPercent: number): void {
  const totalPixels = data.length / 4;
  const clipCount = Math.floor((totalPixels * clipPercent) / 100);

  // Build histogram
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
  }

  // Low percentile
  let cumCount = 0;
  let lo = 0;
  for (let v = 0; v < 256; v++) {
    cumCount += histogram[v];
    if (cumCount >= clipCount) {
      lo = v;
      break;
    }
  }

  // High percentile
  cumCount = 0;
  let hi = 255;
  for (let v = 255; v >= 0; v--) {
    cumCount += histogram[v];
    if (cumCount >= clipCount) {
      hi = v;
      break;
    }
  }

  const range = hi - lo || 1;
  for (let i = 0; i < data.length; i += 4) {
    let v = ((data[i] - lo) / range) * 255;
    v = Math.max(0, Math.min(255, v));
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

/**
 * Compute the optimal binarisation threshold via Otsu's method.
 * Maximises inter-class variance between foreground and background.
 */
function computeOtsuThreshold(data: Uint8ClampedArray): number {
  const totalPixels = data.length / 4;

  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
  }

  let sum = 0;
  for (let v = 0; v < 256; v++) sum += v * histogram[v];

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let bestThreshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      bestThreshold = t;
    }
  }

  return bestThreshold;
}

/**
 * Morphological dilation (3×3 kernel, dark-foreground convention).
 * For binary images with dark text (0) on white (255), dilation expands the
 * dark regions by taking the minimum of each pixel's 3×3 neighbourhood.
 */
function morphDilate(data: Uint8ClampedArray, width: number, height: number): void {
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let minVal = 255;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = ((y + dy) * width + (x + dx)) * 4;
          if (copy[j] < minVal) minVal = copy[j];
        }
      }
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = minVal;
    }
  }
}

/**
 * Morphological erosion (3×3 kernel, dark-foreground convention).
 * Shrinks dark regions by taking the maximum of each pixel's 3×3 neighbourhood.
 */
function morphErode(data: Uint8ClampedArray, width: number, height: number): void {
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let maxVal = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = ((y + dy) * width + (x + dx)) * 4;
          if (copy[j] > maxVal) maxVal = copy[j];
        }
      }
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = maxVal;
    }
  }
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/** Load a data-URL string into an HTMLImageElement. */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
