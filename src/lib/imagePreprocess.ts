/**
 * Image preprocessing utilities for improving OCR accuracy on BP monitor
 * LCD/LED segment displays.
 *
 * LCD segment digits have specific visual characteristics (large, segmented,
 * on a greenish/grey background) that confuse general-purpose OCR.
 * Preprocessing converts the image to a high-contrast black-on-white bitmap
 * so Tesseract can recognise the text more reliably.
 *
 * Pipeline (v5 — with intelligent channel selection, sharpening, multi-scale,
 * glare detection, and deskew):
 * 1. Scale up small images for better OCR resolution.
 * 2. Intelligent channel selection (detect LCD tint: green/blue/white/orange).
 * 3. Detect and crop to the LCD screen region (reduces noise from device
 *    body, table, and other background elements).
 * 4. Contrast stretching with percentile clipping (robust to outliers).
 * 5. Sharpening (unsharp mask to restore blurry LCD segment edges).
 * 6. Local adaptive binarisation (integral-image local mean).
 * 7. Deskew (gradient-based skew detection + affine correction).
 * 8. Morphological closing (dilate → erode) to fill segment gaps.
 * 9. Inversion check — ensure dark text on white background.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single step in the preprocessing pipeline, for debug visualisation. */
export interface PreprocessingStep {
  label: string;
  dataUrl: string;
}

/** Result of glare detection on the LCD region. */
export interface GlareDetectionResult {
  /** Whether significant glare/hotspot was detected. */
  hasGlare: boolean;
  /** Fraction of pixels near saturation (0–1). */
  glareFraction: number;
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
  glare?: GlareDetectionResult;
}> {
  return preprocessBPImageCore(dataUrl, true);
}

/**
 * Generate multiple scaled versions of a preprocessed BP image for
 * multi-scale OCR.  Returns an array of PNG data-URLs at scales
 * 1×, 1.5×, and 2×.
 */
export async function generateMultiScaleImages(dataUrl: string): Promise<string[]> {
  const scales = [1, 1.5, 2];
  const img = await loadImage(dataUrl);

  return scales.map((scale) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = scale <= 1;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  });
}

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

/** Minimum width (px) before scaling up — Tesseract benefits from higher res. */
const MIN_WIDTH = 800;

/**
 * Minimum fraction of the image that must be removed on at least one axis
 * for cropping to take effect.  Prevents unnecessary crops when the image
 * is already tightly framed.
 */
const MIN_CROP_FRACTION = 0.05;

async function preprocessBPImageCore(
  dataUrl: string,
  collectSteps: boolean,
): Promise<{ result: string; steps: PreprocessingStep[]; glare?: GlareDetectionResult }> {
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

  // --- Step 1: Intelligent channel selection ---
  // Detect the dominant LCD tint colour and pick the channel with best
  // digit-to-background contrast.  Falls back to green channel for
  // traditional green-tinted LCD panels.
  const bestChannel = selectBestChannel(data);
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i + bestChannel];
    data[i] = data[i + 1] = data[i + 2] = v;
  }

  if (collectSteps) {
    const channelNames = ['Red', 'Green', 'Blue'];
    ctx.putImageData(imageData, 0, 0);
    steps.push({ label: `${channelNames[bestChannel]} Channel`, dataUrl: canvas.toDataURL('image/png') });
  }

  // --- Step 2: Detect and crop to LCD screen region ---
  // Removing the surrounding device body / table from the image prevents
  // bright background pixels from skewing the Otsu threshold, which
  // previously caused the LCD area to turn entirely dark.
  const region = detectScreenRegion(data, width, height);
  if (region) {
    ctx.putImageData(imageData, 0, 0);

    if (collectSteps) {
      // Draw crop-region overlay on the channel image so the user can
      // see exactly where the algorithm decided to crop.
      const overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = width;
      overlayCanvas.height = height;
      const overlayCtx = overlayCanvas.getContext('2d')!;
      overlayCtx.drawImage(canvas, 0, 0);
      overlayCtx.strokeStyle = 'red';
      overlayCtx.lineWidth = Math.max(2, Math.round(Math.min(width, height) * 0.005));
      overlayCtx.strokeRect(region.x, region.y, region.w, region.h);
      steps.push({ label: 'Crop Region', dataUrl: overlayCanvas.toDataURL('image/png') });
    }

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
  } else if (collectSteps) {
    ctx.putImageData(imageData, 0, 0);
    steps.push({ label: 'Screen Crop (skipped)', dataUrl: canvas.toDataURL('image/png') });
  }

  // --- Step 2b: Glare/hotspot detection ---
  const glare = detectGlare(data);

  // --- Step 3: Contrast stretching with percentile clipping ---
  applyContrastStretch(data, 1);

  if (collectSteps) {
    ctx.putImageData(imageData, 0, 0);
    steps.push({ label: 'Contrast Stretched', dataUrl: canvas.toDataURL('image/png') });
  }

  // --- Step 4: Sharpening (unsharp mask) ---
  applyUnsharpMask(data, width, height);

  if (collectSteps) {
    ctx.putImageData(imageData, 0, 0);
    steps.push({ label: 'Sharpened', dataUrl: canvas.toDataURL('image/png') });
  }

  // --- Step 5: Local adaptive binarisation ---
  // Uses an integral-image local mean to compute a per-pixel threshold.
  // Pixels significantly darker than their local neighbourhood are classified
  // as foreground (digit segments).  This avoids the failure mode of global
  // Otsu, which picks a single threshold dominated by the device body /
  // background and turns the entire LCD area dark.
  adaptiveThreshold(data, width, height);

  if (collectSteps) {
    ctx.putImageData(imageData, 0, 0);
    steps.push({ label: 'Binarised (adaptive)', dataUrl: canvas.toDataURL('image/png') });
  }

  // --- Step 6: Deskew ---
  const skewAngle = detectSkewAngle(data, width, height);
  if (Math.abs(skewAngle) > 0.5) {
    // Apply affine rotation to straighten the image
    const rotated = rotateImage(data, width, height, -skewAngle);
    for (let i = 0; i < data.length; i++) {
      data[i] = rotated[i];
    }

    if (collectSteps) {
      ctx.putImageData(imageData, 0, 0);
      steps.push({ label: `Deskewed (${skewAngle.toFixed(1)}°)`, dataUrl: canvas.toDataURL('image/png') });
    }
  }

  // --- Step 7: Morphological closing (dilate then erode, 3×3 kernel) ---
  // Fills tiny gaps between LCD segments so digits appear solid to Tesseract.
  morphDilate(data, width, height);
  morphErode(data, width, height);

  if (collectSteps) {
    ctx.putImageData(imageData, 0, 0);
    steps.push({ label: 'Morph. Closing', dataUrl: canvas.toDataURL('image/png') });
  }

  // --- Step 8: Inversion check ---
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

  return { result, steps, glare };
}

// ---------------------------------------------------------------------------
// New processing helpers (v5)
// ---------------------------------------------------------------------------

/**
 * Intelligent channel selection — detects the dominant LCD tint colour
 * and returns the channel index (0=R, 1=G, 2=B) with the highest
 * digit-to-background contrast.
 *
 * LCD displays come in several tint variants:
 * - Green (most common) → green channel has best contrast
 * - Blue → blue channel
 * - White/grey → green channel (usually the most balanced)
 * - Orange → red channel
 *
 * The heuristic computes each channel's standard deviation (a proxy for
 * contrast) and returns the channel with the highest value.
 */
function selectBestChannel(data: Uint8ClampedArray): number {
  const totalPixels = data.length / 4;
  const sums = [0, 0, 0];
  const sqSums = [0, 0, 0];

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = data[i + c];
      sums[c] += v;
      sqSums[c] += v * v;
    }
  }

  let bestChannel = 1; // default green
  let bestStdDev = 0;

  for (let c = 0; c < 3; c++) {
    const mean = sums[c] / totalPixels;
    const variance = sqSums[c] / totalPixels - mean * mean;
    const stdDev = Math.sqrt(Math.max(0, variance));
    if (stdDev > bestStdDev) {
      bestStdDev = stdDev;
      bestChannel = c;
    }
  }

  return bestChannel;
}

/**
 * Detect glare/hotspot in the image.  If a significant portion of the
 * LCD region has pixels near saturation (>240), the user should be warned
 * to retake the photo.
 *
 * @returns Object with `hasGlare` flag and `glareFraction` (0–1).
 */
function detectGlare(data: Uint8ClampedArray): GlareDetectionResult {
  const totalPixels = data.length / 4;
  let nearWhiteCount = 0;
  const GLARE_THRESHOLD = 240;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > GLARE_THRESHOLD) {
      nearWhiteCount++;
    }
  }

  const glareFraction = nearWhiteCount / totalPixels;
  return {
    hasGlare: glareFraction > 0.8,
    glareFraction,
  };
}

/**
 * Unsharp mask sharpening to restore blurry LCD segment edges.
 *
 * Computes a 3×3 box-blur approximation, then sharpens by:
 *   sharpened = original + amount * (original − blurred)
 *
 * @param amount — sharpening strength (1.0 = moderate, 2.0 = strong)
 */
function applyUnsharpMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number = 1.0,
): void {
  // Create blurred copy using 3×3 box filter
  const blurred = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += data[(ny * width + nx) * 4];
            count++;
          }
        }
      }
      blurred[y * width + x] = Math.round(sum / count);
    }
  }

  // Apply: sharpened = original + amount × (original − blurred)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const original = data[idx];
      const blur = blurred[y * width + x];
      const sharpened = Math.round(original + amount * (original - blur));
      const clamped = Math.max(0, Math.min(255, sharpened));
      data[idx] = data[idx + 1] = data[idx + 2] = clamped;
    }
  }
}

/**
 * Detect skew angle of the binarised image using gradient-based
 * Hough-like analysis.
 *
 * Scans the binarised image for horizontal edge transitions, then
 * tests a range of small angles (−10° to +10°) to find the rotation
 * that maximises horizontal alignment of edge pixels (i.e. produces
 * the sharpest row projection peaks).
 *
 * Returns the estimated skew angle in degrees.
 */
function detectSkewAngle(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  // Collect edge pixel positions (foreground-to-background transitions)
  const edgePixels: Array<{ x: number; y: number }> = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const left = data[(y * width + (x - 1)) * 4];
      const right = data[(y * width + (x + 1)) * 4];
      // Detect horizontal edges (transitions between black and white)
      if (Math.abs(left - right) > 200) {
        edgePixels.push({ x, y });
      }
    }
  }

  if (edgePixels.length < 20) return 0;

  // Sample edge pixels for speed (max 2000)
  const sample = edgePixels.length > 2000
    ? edgePixels.filter((_, i) => i % Math.ceil(edgePixels.length / 2000) === 0)
    : edgePixels;

  const cx = width / 2;
  const cy = height / 2;

  let bestAngle = 0;
  let bestScore = 0;

  // Test angles from −10° to +10° in 0.5° steps
  for (let angleDeg = -10; angleDeg <= 10; angleDeg += 0.5) {
    const rad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    // Project edge pixels onto rows after rotation
    const rowBins = new Map<number, number>();
    for (const p of sample) {
      const ry = Math.round((p.x - cx) * sinA + (p.y - cy) * cosA + cy);
      rowBins.set(ry, (rowBins.get(ry) ?? 0) + 1);
    }

    // Score = sum of squared bin counts (sharper peaks = better alignment)
    let score = 0;
    for (const count of rowBins.values()) {
      score += count * count;
    }

    if (score > bestScore) {
      bestScore = score;
      bestAngle = angleDeg;
    }
  }

  return bestAngle;
}

/**
 * Rotate image data by a given angle (in degrees) around the centre.
 * Returns a new Uint8ClampedArray with the rotated pixel data.
 */
function rotateImage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  angleDeg: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data.length);
  // Fill with white (background)
  result.fill(255);

  const cx = width / 2;
  const cy = height / 2;
  const rad = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Reverse-map: find source pixel for this destination pixel
      const sx = Math.round((x - cx) * cosA + (y - cy) * sinA + cx);
      const sy = Math.round(-(x - cx) * sinA + (y - cy) * cosA + cy);

      if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
        const srcIdx = (sy * width + sx) * 4;
        const dstIdx = (y * width + x) * 4;
        result[dstIdx] = data[srcIdx];
        result[dstIdx + 1] = data[srcIdx + 1];
        result[dstIdx + 2] = data[srcIdx + 2];
        result[dstIdx + 3] = data[srcIdx + 3];
      }
    }
  }

  return result;
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
 * tightly framed (crop would remove less than `MIN_CROP_FRACTION` on
 * both axes).
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
  for (let y = 0; y < height; y++) rowEdge[y] /= width;
  for (let x = 0; x < width; x++) colEdge[x] /= height;

  const rowRange = findContentRange(rowEdge, height);
  const colRange = findContentRange(colEdge, width);
  if (!rowRange || !colRange) return null;

  // Add 10 % padding so labels adjacent to digits are not clipped.
  // colRange.end / rowRange.end are inclusive indices, so +1 for width/height.
  const rw = colRange.end - colRange.start;
  const rh = rowRange.end - rowRange.start;
  const px = Math.floor(rw * 0.1);
  const py = Math.floor(rh * 0.1);

  const x = Math.max(0, colRange.start - px);
  const y = Math.max(0, rowRange.start - py);
  const w = Math.min(width, colRange.end + px + 1) - x;
  const h = Math.min(height, rowRange.end + py + 1) - y;

  // Only crop if region is meaningfully smaller than full image
  // (at least MIN_CROP_FRACTION removed on one axis).
  if (w >= width * (1 - MIN_CROP_FRACTION) && h >= height * (1 - MIN_CROP_FRACTION)) return null;

  return { x, y, w, h };
}

/**
 * Given a 1-D edge-density profile, return the start/end indices of the
 * primary content region.
 *
 * 1. Smooth with a small moving-average window (2 % of `size`).
 * 2. Set threshold at 30 % of the smoothed peak.
 * 3. Find contiguous segments above the threshold, then return the segment
 *    with the highest total edge mass.
 *
 * Using the densest contiguous segment (rather than the span from first to
 * last above-threshold point) prevents isolated edge peaks — such as the
 * device-body boundary against a dark background — from inflating the
 * detected region to span the entire image.
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

  const threshold = maxV * 0.3;

  // Find the densest contiguous segment above threshold.
  let bestStart = -1;
  let bestEnd = -1;
  let bestMass = 0;

  let segStart = -1;
  let segMass = 0;

  for (let i = 0; i < size; i++) {
    if (smoothed[i] >= threshold) {
      if (segStart === -1) segStart = i;
      segMass += smoothed[i];
    } else {
      if (segStart !== -1) {
        if (segMass > bestMass) {
          bestStart = segStart;
          bestEnd = i - 1;
          bestMass = segMass;
        }
        segStart = -1;
        segMass = 0;
      }
    }
  }
  // Handle segment that extends to the end.
  if (segStart !== -1 && segMass > bestMass) {
    bestStart = segStart;
    bestEnd = size - 1;
  }

  if (bestStart === -1) return null;
  return { start: bestStart, end: bestEnd };
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
 * Local adaptive binarisation using an integral-image local mean
 * (Bradley's method).
 *
 * For each pixel the threshold is `localMean * (1 − sensitivity)`.
 * Pixels darker than the threshold become 0 (foreground / digit segment);
 * the rest become 255 (background).
 *
 * This handles non-uniform lighting and imperfect cropping far better than
 * a single global threshold (e.g. Otsu), which can be skewed by device-body
 * or table pixels and turn the entire LCD area dark.
 *
 * @param windowFraction — neighbourhood radius as a fraction of the smaller
 *   image dimension.  ~12.5 % works well for LCD digit segments.
 * @param sensitivity — a pixel must be this fraction darker than the local
 *   mean to be classified as foreground.  0.15 suits most LCD displays.
 */
function adaptiveThreshold(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  windowFraction: number = 0.125,
  sensitivity: number = 0.15,
): void {
  const totalPixels = width * height;
  // Ensure the window size is odd so it is centred on each pixel.
  const winSize = Math.max(3, Math.floor(Math.min(width, height) * windowFraction) | 1);
  const halfWin = Math.floor(winSize / 2);

  // Build integral image from the red channel (== green after extraction).
  const integral = new Float64Array(totalPixels);
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      rowSum += data[idx * 4];
      integral[idx] = rowSum + (y > 0 ? integral[(y - 1) * width + x] : 0);
    }
  }

  // Apply per-pixel threshold.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - halfWin);
      const y1 = Math.max(0, y - halfWin);
      const x2 = Math.min(width - 1, x + halfWin);
      const y2 = Math.min(height - 1, y + halfWin);

      const count = (x2 - x1 + 1) * (y2 - y1 + 1);

      // Sum of pixel values in the window via the integral image.
      let sum = integral[y2 * width + x2];
      if (x1 > 0) sum -= integral[y2 * width + (x1 - 1)];
      if (y1 > 0) sum -= integral[(y1 - 1) * width + x2];
      if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * width + (x1 - 1)];

      const localMean = sum / count;
      const t = localMean * (1 - sensitivity);

      const i = (y * width + x) * 4;
      const bw = data[i] < t ? 0 : 255;
      data[i] = data[i + 1] = data[i + 2] = bw;
    }
  }
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
