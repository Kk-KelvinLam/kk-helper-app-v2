/**
 * Reusable React component for client-side blood-pressure OCR.
 *
 * Primary path: TensorFlow.js CNN model running entirely in the browser.
 * Fallback path: Tesseract.js OCR with image preprocessing, used when the
 * TF.js model files are unavailable (e.g. not yet deployed).
 *
 * @module BPOcrCapture
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { useBPModel } from '@/hooks/useBPModel';
import { combineBPReadings, isPlausibleBPReading, type BPReading } from '@/lib/bpOcrUtils';
import { preprocessBPImage, preprocessBPImageLight, extractImageStrips } from '@/lib/imagePreprocess';
import { parseBPText } from '@/lib/ocrParser';

// ──────────────────────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────────────────────

export interface BPOcrCaptureProps {
  /**
   * Called when the model has successfully predicted BP values from the image.
   * Receives the combined {@link BPReading} with SYS, DIA, and optional Pulse.
   */
  onResult: (reading: BPReading) => void;
  /** Called when the raw image is captured (before inference). */
  onImageCaptured?: (imageDataUrl: string) => void;
  /** Called to close / dismiss the capture UI. */
  onClose: () => void;
  /** Optional dialog title override. */
  title?: string;
  /** Optional hint text displayed below the capture buttons. */
  hint?: string;
  /**
   * Optional callback invoked with the raw text representation of results.
   * Provided for backward-compatibility with text-based OCR flows
   * (e.g. BloodPressurePage's `handleBPTextExtracted`).
   */
  onTextExtracted?: (text: string, digitOnlyText?: string) => void;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

type CameraState = 'idle' | 'streaming' | 'preview';

/**
 * Client-side BP OCR capture modal.
 *
 * The TensorFlow.js model is loaded once on mount (typically < 2 s on modern
 * phones) and cached in memory for the lifetime of the component.  All
 * preprocessing and inference happen on-device — no network requests are
 * made after the initial model download.
 */
export default function BPOcrCapture({
  onResult,
  onImageCaptured,
  onClose,
  title,
  hint,
  onTextExtracted,
}: BPOcrCaptureProps) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const { isReady, isLoading: modelLoading, error: modelError, predict } = useBPModel();

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Camera helpers ───────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  /** Clean up on unmount. */
  useEffect(() => () => stopCamera(), [stopCamera]);

  /** Bind stream to video element when state transitions to streaming. */
  useEffect(() => {
    if (cameraState === 'streaming' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraState]);

  const startCamera = async () => {
    setError(null);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      setCameraState('streaming');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError(t('cameraPermissionDenied'));
      } else {
        setError(t('cameraNotAvailable'));
      }
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    setImagePreview(dataUrl);
    stopCamera();
    setCameraState('preview');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
      setCameraState('preview');
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setImagePreview(null);
    setError(null);
    setCameraState('idle');
  };

  // ── Inference ────────────────────────────────────────────────────────────

  /**
   * Run the TF.js CNN model on the captured image.
   *
   * Primary path: TF.js CNN model (fast, runs entirely on-device).
   * Fallback path: Tesseract.js OCR with BP image preprocessing, used when
   * the TF.js model files are unavailable.
   */
  const runInference = async () => {
    if (!imagePreview) return;

    setProcessing(true);
    setProgress(10);
    setError(null);

    try {
      if (onImageCaptured) onImageCaptured(imagePreview);

      if (isReady) {
        // ── TF.js CNN inference path ────────────────────────────────────────

        setProgress(30);
        const sysValue = await predict(imagePreview);
        setProgress(70);

        let diaValue: number | null = null;
        // TODO: Pulse detection not yet implemented — requires a separate crop
        // region or a dedicated pulse model.  Currently always null.
        const pulseValue: number | null = null;

        try {
          const lowerCrop = await cropLowerRegion(imagePreview);
          if (lowerCrop) {
            diaValue = await predict(lowerCrop);
            setProgress(85);
          }
        } catch {
          // Single-image mode — diastolic extraction failed; that's OK.
        }

        setProgress(100);

        const reading = combineBPReadings(sysValue, diaValue ?? 0, pulseValue);
        onResult(reading);

        if (onTextExtracted) {
          onTextExtracted(`${reading.systolic}/${reading.diastolic}`);
        }

        if (!isPlausibleBPReading(reading)) {
          setError(t('imageProcessError'));
        }
      } else {
        // ── Tesseract.js fallback path ──────────────────────────────────────

        setProgress(20);
        const preprocessed = await preprocessBPImage(imagePreview);
        setProgress(35);

        // Primary OCR pass (eng, sparse-text PSM for LCD displays)
        const primaryOcr = async (input: string) => {
          const worker = await Tesseract.createWorker('eng');
          await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
          });
          const res = await worker.recognize(input);
          await worker.terminate();
          return { text: res.data.text.trim(), confidence: res.data.confidence };
        };

        // Digit-only pass for better seven-segment LCD accuracy
        const digitOcr = async (input: string) => {
          const worker = await Tesseract.createWorker('eng');
          await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
            tessedit_char_whitelist: '0123456789 ',
          });
          const res = await worker.recognize(input);
          await worker.terminate();
          return res.data.text.trim();
        };

        let [primaryResult, digitOnlyText] = await Promise.all([
          primaryOcr(preprocessed),
          digitOcr(preprocessed),
        ]);
        setProgress(60);

        // Fallback A: strip-based OCR when confidence is low
        if (primaryResult.confidence < 60) {
          try {
            const strips = await extractImageStrips(preprocessed);
            if (strips.length >= 2) {
              const stripWorker = await Tesseract.createWorker('eng');
              await stripWorker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
                tessedit_char_whitelist: '0123456789 ',
              });
              const stripTexts: string[] = [];
              let totalConf = 0;
              for (const strip of strips) {
                const res = await stripWorker.recognize(strip.dataUrl);
                const text = res.data.text.trim();
                if (text) { stripTexts.push(text); totalConf += res.data.confidence; }
              }
              await stripWorker.terminate();
              if (stripTexts.length >= 2) {
                const avgConf = totalConf / stripTexts.length;
                const combined = stripTexts.join('\n');
                if (avgConf > primaryResult.confidence) {
                  primaryResult = { text: combined, confidence: avgConf };
                }
                if (!digitOnlyText) digitOnlyText = combined;
              }
            }
          } catch { /* strip OCR failed; continue */ }
        }
        setProgress(80);

        // Fallback B: contrast-enhanced image without binarisation
        if (primaryResult.confidence < 60) {
          try {
            const lightInput = await preprocessBPImageLight(imagePreview);
            const [lightResult, lightDigit] = await Promise.all([
              primaryOcr(lightInput),
              digitOcr(lightInput),
            ]);
            if (lightResult.confidence > primaryResult.confidence) {
              primaryResult = lightResult;
              if (lightDigit) digitOnlyText = lightDigit;
            }
          } catch { /* light preprocessing OCR failed; continue */ }
        }
        setProgress(95);

        const parsed = parseBPText(primaryResult.text, digitOnlyText);
        const sys = parseInt(parsed.systolic, 10) || 0;
        const dia = parseInt(parsed.diastolic, 10) || 0;
        const pulse = parsed.heartRate ? parseInt(parsed.heartRate, 10) || null : null;

        const reading = combineBPReadings(sys, dia, pulse);
        onResult(reading);

        if (onTextExtracted) {
          onTextExtracted(primaryResult.text, digitOnlyText);
        }

        setProgress(100);

        if (!isPlausibleBPReading(reading)) {
          setError(t('imageProcessError'));
        }
      }
    } catch {
      setError(t('imageProcessError'));
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={`rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {title || t('captureReceipt')}
          </h2>
          <button
            onClick={handleClose}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          >
            <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>

        {/* Model status */}
        {modelLoading && (
          <div className={`text-sm p-3 rounded-lg mb-4 flex items-center gap-2 ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading BP model…
          </div>
        )}
        {modelError && (
          <div className={`text-sm p-3 rounded-lg mb-4 ${isDark ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-50 text-yellow-700'}`}>
            {t('bpModelUnavailable')}
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        {/* Idle — capture / upload buttons */}
        {cameraState === 'idle' && (
          <div className="space-y-3">
            <button
              onClick={startCamera}
              disabled={modelLoading}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl transition-colors disabled:opacity-50"
            >
              <Camera className="w-5 h-5" />
              {t('takePhoto')}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={modelLoading}
              className={`w-full flex items-center justify-center gap-3 font-medium py-3 px-6 rounded-xl transition-colors border disabled:opacity-50 ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              <Upload className="w-5 h-5" />
              {t('uploadImage')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {error && (
              <div className={`text-sm p-3 rounded-lg ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'}`}>
                {error}
              </div>
            )}
            <p className={`text-xs text-center mt-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {hint || t('captureHint')}
            </p>
          </div>
        )}

        {/* Streaming — live camera */}
        {cameraState === 'streaming' && (
          <div className="space-y-4">
            <div className={`relative rounded-xl overflow-hidden border ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full rounded-xl ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { stopCamera(); setCameraState('idle'); }}
                className={`flex-1 py-2.5 px-4 rounded-xl border font-medium transition-colors ${
                  isDark
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t('cancel')}
              </button>
              <button
                onClick={capturePhoto}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                {t('takePhoto')}
              </button>
            </div>
          </div>
        )}

        {/* Preview — captured / uploaded image */}
        {cameraState === 'preview' && imagePreview && (
          <div className="space-y-4">
            <div className={`relative rounded-xl overflow-hidden border ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
              <img
                src={imagePreview}
                alt="Captured"
                className={`w-full max-h-64 object-contain ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}
              />
            </div>

            {error && (
              <div className={`text-sm p-3 rounded-lg ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'}`}>
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleRetake}
                className={`flex-1 py-2.5 px-4 rounded-xl border font-medium transition-colors ${
                  isDark
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t('retake')}
              </button>
              <button
                onClick={runInference}
                disabled={processing || modelLoading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {progress > 0 ? `${progress}%` : t('processing')}
                  </>
                ) : (
                  t('extractText')
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Crop the lower ~50 % of an image to isolate the diastolic region of a
 * BP monitor display (where DIA is typically shown below SYS).
 *
 * @param dataUrl - Source image as data-URL
 * @returns Data-URL of the cropped region, or `null` if cropping fails
 */
async function cropLowerRegion(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const startY = Math.floor(img.height * 0.45);
      canvas.width = img.width;
      canvas.height = img.height - startY;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, startY, img.width, canvas.height, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
