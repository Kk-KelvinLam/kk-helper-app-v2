/**
 * Client-side blood-pressure OCR inference using TensorFlow.js.
 *
 * Loads the pre-trained CNN model from `/models/bp-ocr/model.json` (converted
 * from the Keras `best_model.h5` via `tensorflowjs_converter`), preprocesses
 * a captured image of an Omron LCD display into a 180×80 grayscale tensor,
 * and returns a 3-digit regression value (0–999) for the displayed reading.
 *
 * npm install @tensorflow/tfjs @tensorflow/tfjs-backend-webgl
 *
 * @module bpOcrInference
 */

import * as tf from '@tensorflow/tfjs';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

/** Width expected by the CNN model (pixels). */
const MODEL_INPUT_WIDTH = 180;

/** Height expected by the CNN model (pixels). */
const MODEL_INPUT_HEIGHT = 80;

/** Number of colour channels (1 = grayscale). */
const MODEL_INPUT_CHANNELS = 1;

/** Default path to the TF.js model topology JSON served from `/public`. */
const DEFAULT_MODEL_URL = '/models/bp-ocr/model.json';

// ──────────────────────────────────────────────────────────────────────────────
// Model singleton
// ──────────────────────────────────────────────────────────────────────────────

/** Cached model instance so we only download & parse once. */
let cachedModel: tf.LayersModel | null = null;

/** In-flight model loading promise to prevent duplicate downloads. */
let loadingPromise: Promise<tf.LayersModel> | null = null;

/**
 * Load (or return the cached) TensorFlow.js Layers model.
 *
 * The model is downloaded **once** from the given URL and kept in memory for
 * subsequent inferences.  On modern phones this typically completes in < 2 s.
 *
 * @param modelUrl - URL to the `model.json` file (default: `/models/bp-ocr/model.json`)
 * @returns The loaded `tf.LayersModel` ready for `.predict()`
 */
export async function loadBPModel(
  modelUrl: string = DEFAULT_MODEL_URL,
): Promise<tf.LayersModel> {
  if (cachedModel) return cachedModel;

  // Prevent duplicate concurrent downloads
  if (!loadingPromise) {
    loadingPromise = (async () => {
      // Ensure the WebGL backend is ready (fastest browser backend).
      await tf.ready();

      const model = await tf.loadLayersModel(modelUrl);
      cachedModel = model;
      loadingPromise = null;
      return model;
    })();
  }

  return loadingPromise;
}

/**
 * Release the cached model and free GPU/WebGL memory.
 *
 * Call this when the BP OCR feature is unmounted to reclaim resources.
 */
export function disposeBPModel(): void {
  if (cachedModel) {
    cachedModel.dispose();
    cachedModel = null;
  }
  loadingPromise = null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Image preprocessing
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Load an image from a data-URL or object URL into an `HTMLImageElement`.
 *
 * @param src - Data-URL (`data:image/…`) or blob URL of the image
 * @returns Resolved `HTMLImageElement`
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Preprocess a captured BP monitor image into the tensor shape expected by
 * the CNN model: `[1, 80, 180, 1]` (batch × height × width × channels).
 *
 * Steps:
 * 1. Draw the source image onto a 180×80 off-screen canvas (bilinear resize).
 * 2. Extract pixel data and convert to single-channel grayscale using
 *    luminance weights (0.299 R + 0.587 G + 0.114 B).
 * 3. Normalise pixel intensities to the 0–1 float range.
 * 4. Reshape into a rank-4 tensor suitable for `model.predict()`.
 *
 * @param imageSource - Data-URL or object URL of the captured image
 * @returns A `tf.Tensor4D` with shape `[1, 80, 180, 1]`
 */
export async function preprocessImage(
  imageSource: string,
): Promise<tf.Tensor4D> {
  const img = await loadImage(imageSource);

  // Use an off-screen canvas to resize the image to model dimensions.
  const canvas = document.createElement('canvas');
  canvas.width = MODEL_INPUT_WIDTH;
  canvas.height = MODEL_INPUT_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Draw with bilinear interpolation (default browser behaviour)
  ctx.drawImage(img, 0, 0, MODEL_INPUT_WIDTH, MODEL_INPUT_HEIGHT);

  // Extract raw RGBA pixel data
  const imageData = ctx.getImageData(0, 0, MODEL_INPUT_WIDTH, MODEL_INPUT_HEIGHT);
  const { data } = imageData; // Uint8ClampedArray [R,G,B,A, R,G,B,A, …]

  const numPixels = MODEL_INPUT_WIDTH * MODEL_INPUT_HEIGHT;
  const grayscale = new Float32Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const offset = i * 4;
    // ITU-R BT.601 luminance weights
    const lum = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
    // Normalise from [0, 255] to [0, 1]
    grayscale[i] = lum / 255;
  }

  // Shape: [batch, height, width, channels]
  return tf.tensor4d(grayscale, [1, MODEL_INPUT_HEIGHT, MODEL_INPUT_WIDTH, MODEL_INPUT_CHANNELS]);
}

// ──────────────────────────────────────────────────────────────────────────────
// Inference
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Run inference on a single BP monitor image and return the predicted
 * blood-pressure value (0–999).
 *
 * The function handles model loading (if not yet cached), preprocessing, and
 * tensor cleanup to avoid memory leaks.
 *
 * @param imageSource - Data-URL or object URL of the BP display image
 * @param modelUrl    - Optional override for the model location
 * @returns The predicted BP reading rounded to the nearest integer
 */
export async function predictBPValue(
  imageSource: string,
  modelUrl?: string,
): Promise<number> {
  // 1. Ensure the model is loaded (cached after first call)
  const model = await loadBPModel(modelUrl);

  // 2. Preprocess the image into the expected tensor shape
  const inputTensor = await preprocessImage(imageSource);

  try {
    // 3. Run forward pass — model outputs a single regression value
    const prediction = model.predict(inputTensor) as tf.Tensor;
    const [value] = await prediction.data();

    // 4. Clean up intermediate tensors to prevent GPU memory leaks
    prediction.dispose();

    // 5. Clamp and round to a valid BP integer
    return Math.round(Math.max(0, Math.min(999, value)));
  } finally {
    // Always dispose the input tensor
    inputTensor.dispose();
  }
}
