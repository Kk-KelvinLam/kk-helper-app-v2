/**
 * React hook for loading and managing the TensorFlow.js BP OCR model.
 *
 * Handles one-time model download, caching, readiness state, and cleanup.
 * Designed for React 18+ with strict-mode safety (double-mount tolerance).
 *
 * npm install @tensorflow/tfjs @tensorflow/tfjs-backend-webgl
 *
 * @module useBPModel
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isReady, isLoading, error, predict } = useBPModel();
 *
 *   const handleCapture = async (imageDataUrl: string) => {
 *     if (!isReady) return;
 *     const value = await predict(imageDataUrl);
 *     console.log('Predicted BP:', value);
 *   };
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { loadBPModel, disposeBPModel, predictBPValue } from '@/lib/bpOcrInference';

/** State returned by the {@link useBPModel} hook. */
export interface UseBPModelResult {
  /** `true` once the model has been downloaded and is ready for inference. */
  isReady: boolean;
  /** `true` while the model is being downloaded / initialised. */
  isLoading: boolean;
  /** Human-readable error message if model loading failed. */
  error: string | null;
  /**
   * Run inference on a BP display image.
   *
   * @param imageSource - Data-URL or object URL of the captured image
   * @returns The predicted BP value (0–999)
   * @throws If the model is not yet loaded or inference fails
   */
  predict: (imageSource: string) => Promise<number>;
}

/**
 * Custom React hook that loads the TensorFlow.js BP OCR model on mount
 * and provides a `predict` function for running inference.
 *
 * NOTE: The model files (`model.json` + weight shards) are downloaded
 * **once** from the server on first use and cached in-memory.  Subsequent
 * mounts reuse the cached model, so re-renders are effectively free.
 *
 * @param modelUrl - Optional override for the model.json URL
 * @returns {@link UseBPModelResult}
 */
export function useBPModel(modelUrl?: string): UseBPModelResult {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track whether this effect instance is still mounted (strict-mode safe)
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      try {
        await loadBPModel(modelUrl);
        if (mountedRef.current) {
          setIsReady(true);
          setIsLoading(false);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load BP OCR model',
          );
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      // Dispose the model when the last consumer unmounts.
      // If another component still needs it, loadBPModel() will re-download.
      disposeBPModel();
    };
  }, [modelUrl]);

  /**
   * Stable callback that runs a single inference.
   * Throws if the model is not ready (caller should check `isReady` first).
   */
  const predict = useCallback(
    async (imageSource: string): Promise<number> => {
      return predictBPValue(imageSource, modelUrl);
    },
    [modelUrl],
  );

  return { isReady, isLoading, error, predict };
}
