/**
 * Image preprocessing utilities for improving OCR accuracy on BP monitor
 * LCD/LED segment displays.
 *
 * LCD segment digits have specific visual characteristics (large, segmented,
 * on a greenish/grey background) that confuse general-purpose OCR.
 * Preprocessing converts the image to a high-contrast black-on-white bitmap
 * so Tesseract can recognise the text more reliably.
 */

/**
 * Preprocess a BP-monitor photo for OCR.
 *
 * Pipeline:
 * 1. Decode the data-URL into an off-screen canvas.
 * 2. Convert to greyscale.
 * 3. Apply contrast stretching (histogram normalisation).
 * 4. Binarise with a fixed threshold so digits become solid black
 *    and the background becomes white.
 * 5. Return the result as a PNG data-URL.
 */
export async function preprocessBPImage(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl; // fallback – return original if canvas unavailable

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  // --- Step 1: Convert to greyscale ---
  for (let i = 0; i < data.length; i += 4) {
    const grey = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = grey;
  }

  // --- Step 2: Contrast stretching ---
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = max - min || 1;
  for (let i = 0; i < data.length; i += 4) {
    const stretched = ((data[i] - min) / range) * 255;
    data[i] = data[i + 1] = data[i + 2] = stretched;
  }

  // --- Step 3: Binarise (threshold) ---
  // A mid-range threshold works well for most LCD/LED segment displays where
  // the digits are considerably darker than the background after contrast
  // stretching.  Adaptive methods (e.g. Otsu) would require a histogram pass
  // and add complexity with limited benefit for this use-case.
  const BINARISE_THRESHOLD = 128;
  for (let i = 0; i < data.length; i += 4) {
    const bw = data[i] < BINARISE_THRESHOLD ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = bw;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// Helpers
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
