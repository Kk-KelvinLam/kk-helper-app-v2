/**
 * Image preprocessing utilities for improving OCR accuracy on BP monitor
 * LCD/LED segment displays.
 *
 * LCD segment digits have specific visual characteristics (large, segmented,
 * on a greenish/grey background) that confuse general-purpose OCR.
 * Preprocessing converts the image to a high-contrast black-on-white bitmap
 * so Tesseract can recognise the text more reliably.
 *
 * Pipeline (v3 — with LCD screen cropping):
 * 1. Scale up small images for better OCR resolution.
 * 2. Extract the green channel (best contrast for green-tinted LCD panels).
 * 3. Detect and crop to the LCD screen region (reduces noise from device
 *    body, table, and other background elements so that subsequent steps
 *    operate on a cleaner histogram).
 * 4. Contrast stretching with percentile clipping (robust to outliers).
 * 5. Adaptive binarisation via Otsu's method.
 * 6. Morphological closing (dilate → erode) to fill segment gaps.
 * 7. Inversion check — ensure dark text on white background.
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
  let width = img.width * scale;
  let height = img.height * scale;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { result: dataUrl, steps: [] };

  // Disable image smoothing when scaling up by more than 2× so LCD segment
  // edges stay crisp (nearest-neighbour interpolation).  At lower scale factors
  // smoothing is acceptable and avoids aliasing artefacts.
  ctx.imageSmoothingEnabled = scale <= 2;
  ctx.drawImage(img, 0, 0, width, height);

  if (collectSteps) {
    steps.push({ label: 'Original', dataUrl: canvas.toDataURL('image/png') });
  }

  let imageData = ctx.getImageData(0, 0, width, height);
  let data = imageData.data;

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

  // --- Step 2: Detect and crop to LCD screen region ---
  // Removing the surrounding device body / table from the image prevents
  // bright background pixels from skewing the Otsu threshold, which
  // previously caused the LCD area to turn entirely dark.
  const region = detectScreenRegion(data, width, height);
  if (region) {
    ctx.putImageData(imageData, 0, 0);
    const croppedImageData = ctx.getImageData(region.x, region.y, region.w, region.h);
    canvas.width = region.w;
    canvas.height = region.h;
    width = region.w;
    height = region.h;
    ctx.putImageData(croppedImageData, 0, 0);
    imageData = croppedImageData;
    data = imageData.data;

    if (collectSteps) {
      steps.push({ label: 'Screen Crop', dataUrl: canvas.toDataURL('image/png') });
    }
  }

  // --- Step 3: Contrast stretching with percentile clipping ---
  applyContrastStretch(data, 1);

  if (collectSteps) {
    ctx.putImageData(imageData, 0, 0);
    steps.push({ label: 'Contrast Stretched', dataUrl: canvas.toDataURL('image/png') });
  }

  // --- Step 4: Otsu's adaptive binarisation ---
  const threshold = computeOtsuThreshold(data);
  for (let i = 0; i < data.length; i += 4) {
    const bw = data[i] < threshold ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = bw;
  }

  if (collectSteps) {
    ctx.putImageData(imageData, 0, 0);
    steps.push({ label: `Binarised (Otsu t=${threshold})`, dataUrl: canvas.toDataURL('image/png') });
  }

  // --- Step 5: Morphological closing (dilate then erode, 3×3 kernel) ---
  // Fills tiny gaps between LCD segments so digits appear solid to Tesseract.
  morphDilate(data, width, height);
  morphErode(data, width, height);

  if (collectSteps) {
    ctx.putImageData(imageData, 0, 0);
    steps.push({ label: 'Morph. Closing', dataUrl: canvas.toDataURL('image/png') });
  }

  // --- Step 6: Inversion check ---
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
 * Detect the LCD screen region using edge-density projection.
 *
 * Rows and columns crossing digit segments exhibit high gradient sums,
 * while rows/columns outside the screen (device body, table) have low
 * gradients.  We smooth the per-row / per-column gradient profiles and
 * pick the contiguous range that exceeds a fraction of the peak — this
 * closely approximates the screen bounding box.
 *
 * Returns the crop rectangle, or `null` if the image already appears
 * tightly framed (crop would remove < 15 % on both axes).
 */
function detectScreenRegion(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } | null {
  // Build per-row and per-column edge-density profiles.
  const rowEdge = new Float64Array(height);
  const colEdge = new Float64Array(width);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const gx = Math.abs(data[idx] - data[(y * width + (x - 1)) * 4]);
      const gy = Math.abs(data[idx] - data[((y - 1) * width + x) * 4]);
      const g = Math.max(gx, gy);
      rowEdge[y] += g;
      colEdge[x] += g;
    }
  }

  // Normalise to per-pixel average.
  for (let y = 0; y < height; y++) rowEdge[y] /= width || 1;
  for (let x = 0; x < width; x++) colEdge[x] /= height || 1;

  const rowRange = findContentRange(rowEdge, height);
  const colRange = findContentRange(colEdge, width);
  if (!rowRange || !colRange) return null;

  // Add 10 % padding so labels adjacent to digits are not clipped.
  const rw = colRange.end - colRange.start;
  const rh = rowRange.end - rowRange.start;
  const px = Math.floor(rw * 0.1);
  const py = Math.floor(rh * 0.1);

  const x = Math.max(0, colRange.start - px);
  const y = Math.max(0, rowRange.start - py);
  const w = Math.min(width, colRange.end + px + 1) - x;
  const h = Math.min(height, rowRange.end + py + 1) - y;

  // Only crop if region is meaningfully smaller than full image.
  if (w >= width * 0.85 && h >= height * 0.85) return null;

  return { x, y, w, h };
}

/**
 * Given a 1-D edge-density profile, return the start/end indices of the
 * primary content region.
 *
 * 1. Smooth with a small moving-average window (2 % of `size`).
 * 2. Set threshold at 20 % of the smoothed peak.
 * 3. Return the first and last indices that exceed the threshold.
 */
function findContentRange(
  profile: Float64Array,
  size: number,
): { start: number; end: number } | null {
  const win = Math.max(1, Math.floor(size * 0.02));
  const smoothed = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    let s = 0;
    let c = 0;
    const lo = Math.max(0, i - win);
    const hi = Math.min(size - 1, i + win);
    for (let j = lo; j <= hi; j++) {
      s += profile[j];
      c++;
    }
    smoothed[i] = s / c;
  }

  let maxV = 0;
  for (let i = 0; i < size; i++) {
    if (smoothed[i] > maxV) maxV = smoothed[i];
  }
  if (maxV === 0) return null;

  const threshold = maxV * 0.2;

  let start = -1;
  let end = -1;
  for (let i = 0; i < size; i++) {
    if (smoothed[i] >= threshold) {
      if (start === -1) start = i;
      end = i;
    }
  }

  if (start === -1) return null;
  return { start, end };
}

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
