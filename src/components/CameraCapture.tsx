import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { extractImageStrips } from '@/lib/imagePreprocess';

interface CameraCaptureProps {
  onTextExtracted: (text: string, digitOnlyText?: string) => void;
  onImageCaptured?: (imageDataUrl: string) => void;
  onClose: () => void;
  title?: string;
  hint?: string;
  /** Tesseract language string. Defaults to 'eng+chi_tra'. */
  ocrLanguage?: string;
  /** Optional image preprocessor applied before OCR (e.g. contrast enhancement for LCD displays). */
  preprocessImage?: (dataUrl: string) => Promise<string>;
  /** Optional Tesseract worker parameters (e.g. PSM mode). When provided, uses a worker instead of the simple API. */
  ocrParams?: Record<string, string>;
  /**
   * Optional second-pass OCR parameters for digit-only recognition.
   * When provided, runs a parallel Tesseract pass with 'eng' language and
   * these params, then passes the result as the second argument to
   * onTextExtracted.  Useful for seven-segment LCD displays where a
   * digit-only whitelist improves accuracy.
   */
  ocrSecondPassParams?: Record<string, string>;
  /**
   * Optional callback invoked with the OCR confidence score (0–100).
   * Useful for displaying confidence in the UI.
   */
  onConfidence?: (confidence: number) => void;
  /**
   * Optional callback to provide multi-scale image variants for
   * confidence-based retry.  When provided, if the initial OCR confidence
   * is below the retry threshold, the next scaled variant is tried.
   */
  multiScaleImages?: string[];
  /**
   * Optional light preprocessor that produces a contrast-enhanced grayscale
   * image (no binarisation).  Used as an alternative OCR input when the
   * standard binarised pipeline produces low confidence.
   */
  preprocessImageLight?: (dataUrl: string) => Promise<string>;
}

type CameraState = 'idle' | 'streaming' | 'preview';

/** Minimum OCR confidence (0–100) below which a retry with the next scale is attempted. */
const CONFIDENCE_RETRY_THRESHOLD = 60;

export default function CameraCapture({ onTextExtracted, onImageCaptured, onClose, title, hint, ocrLanguage, preprocessImage, ocrParams, ocrSecondPassParams, onConfidence, multiScaleImages, preprocessImageLight }: CameraCaptureProps) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistent Tesseract worker pool — initialised on mount, reused across captures
  const primaryWorkerRef = useRef<Tesseract.Worker | null>(null);
  const digitWorkerRef = useRef<Tesseract.Worker | null>(null);
  const workersInitialisedRef = useRef(false);

  const lang = ocrLanguage || 'eng+chi_tra';

  // Initialise worker pool on mount
  useEffect(() => {
    let cancelled = false;

    const initWorkers = async () => {
      try {
        if (ocrParams) {
          const worker = await Tesseract.createWorker(lang, undefined, {
            logger: (m: { progress?: number }) => {
              if (m.progress !== undefined) {
                setOcrProgress(Math.round(m.progress * 100));
              }
            },
          });
          await worker.setParameters(ocrParams);
          if (!cancelled) primaryWorkerRef.current = worker;
        }

        if (ocrSecondPassParams) {
          const digitWorker = await Tesseract.createWorker('eng');
          await digitWorker.setParameters(ocrSecondPassParams);
          if (!cancelled) digitWorkerRef.current = digitWorker;
        }

        if (!cancelled) workersInitialisedRef.current = true;
      } catch {
        // Worker init can fail in some environments; extractTextFromImage
        // handles this by falling back to inline worker creation.
      }
    };

    initWorkers();

    return () => {
      cancelled = true;
      primaryWorkerRef.current?.terminate();
      digitWorkerRef.current?.terminate();
      primaryWorkerRef.current = null;
      digitWorkerRef.current = null;
      workersInitialisedRef.current = false;
    };
  }, [lang, ocrParams, ocrSecondPassParams]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

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

  const extractTextFromImage = async () => {
    if (!imagePreview) return;

    setProcessing(true);
    setOcrProgress(0);
    setError(null);

    try {
      // Optionally preprocess the image (e.g. contrast enhancement for LCD displays)
      const ocrInput = preprocessImage ? await preprocessImage(imagePreview) : imagePreview;

      // Primary OCR pass (with full language support for label detection)
      const primaryOcr = async (input: string): Promise<{ text: string; confidence: number }> => {
        if (primaryWorkerRef.current) {
          const result = await primaryWorkerRef.current.recognize(input);
          return { text: result.data.text.trim(), confidence: result.data.confidence };
        }
        if (ocrParams) {
          const worker = await Tesseract.createWorker(lang);
          await worker.setParameters(ocrParams);
          const result = await worker.recognize(input);
          await worker.terminate();
          return { text: result.data.text.trim(), confidence: result.data.confidence };
        }
        const result = await Tesseract.recognize(input, lang);
        return { text: result.data.text.trim(), confidence: result.data.confidence };
      };

      // Optional second pass with digit-only params (e.g. whitelist='0123456789').
      // Runs in parallel with the primary pass for minimal additional latency.
      // Uses 'eng' only — digit recognition is language-independent.
      const secondaryOcr = async (input: string): Promise<string | undefined> => {
        if (!ocrSecondPassParams) return undefined;
        if (digitWorkerRef.current) {
          const result = await digitWorkerRef.current.recognize(input);
          return result.data.text.trim();
        }
        const worker = await Tesseract.createWorker('eng');
        await worker.setParameters(ocrSecondPassParams);
        const result = await worker.recognize(input);
        await worker.terminate();
        return result.data.text.trim();
      };

      let [primaryResult, digitOnlyText] = await Promise.all([
        primaryOcr(ocrInput),
        secondaryOcr(ocrInput),
      ]);

      // Confidence-based retry with scaled image variants
      if (
        primaryResult.confidence < CONFIDENCE_RETRY_THRESHOLD &&
        multiScaleImages &&
        multiScaleImages.length > 0
      ) {
        for (const scaledImage of multiScaleImages) {
          const retryResult = await primaryOcr(scaledImage);
          if (retryResult.confidence > primaryResult.confidence) {
            primaryResult = retryResult;
            // Also retry digit-only on the better scale
            const retryDigit = await secondaryOcr(scaledImage);
            if (retryDigit) digitOnlyText = retryDigit;
          }
          if (primaryResult.confidence >= CONFIDENCE_RETRY_THRESHOLD) break;
        }
      }

      // -----------------------------------------------------------------
      // Fallback strategies — "out of the box" alternatives
      // When the standard full-image OCR produces low confidence, try
      // fundamentally different approaches instead of just tweaking params.
      // -----------------------------------------------------------------

      if (primaryResult.confidence < CONFIDENCE_RETRY_THRESHOLD) {
        // --- Fallback A: Strip-based OCR (PSM 7 — single text line) ---
        // Split the preprocessed image into horizontal strips (one per
        // digit row) and OCR each strip individually.  Tesseract performs
        // dramatically better on single lines than on multi-line images.
        try {
          const strips = await extractImageStrips(ocrInput);
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
              if (text) {
                stripTexts.push(text);
                totalConf += res.data.confidence;
              }
            }
            await stripWorker.terminate();

            if (stripTexts.length >= 2) {
              const avgConf = totalConf / stripTexts.length;
              const combinedText = stripTexts.join('\n');
              if (avgConf > primaryResult.confidence || !digitOnlyText) {
                // Strip OCR produced better results — use them
                if (avgConf > primaryResult.confidence) {
                  primaryResult = { text: combinedText, confidence: avgConf };
                }
                digitOnlyText = combinedText;
              }
            }
          }
        } catch {
          // Strip-based OCR failed; continue with existing results
        }
      }

      if (primaryResult.confidence < CONFIDENCE_RETRY_THRESHOLD && preprocessImageLight) {
        // --- Fallback B: OCR on contrast-enhanced (non-binarised) image ---
        // Binarisation can destroy information.  Try OCR on a high-contrast
        // grayscale image that skips the adaptive thresholding step.
        try {
          const lightInput = await preprocessImageLight(imagePreview);
          const [lightResult, lightDigit] = await Promise.all([
            primaryOcr(lightInput),
            secondaryOcr(lightInput),
          ]);
          if (lightResult.confidence > primaryResult.confidence) {
            primaryResult = lightResult;
            if (lightDigit) digitOnlyText = lightDigit;
          }
        } catch {
          // Light preprocessing OCR failed; continue with existing results
        }
      }

      // Report confidence score
      if (onConfidence) {
        onConfidence(primaryResult.confidence);
      }

      if (onImageCaptured) {
        onImageCaptured(imagePreview);
      }
      onTextExtracted(primaryResult.text || t('noTextDetected'), digitOnlyText);
    } catch {
      setError(t('imageProcessError'));
    } finally {
      setProcessing(false);
      setOcrProgress(0);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={`rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title || t('captureReceipt')}</h2>
          <button
            onClick={handleClose}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          >
            <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {cameraState === 'idle' && (
          <div className="space-y-3">
            <button
              onClick={startCamera}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
            >
              <Camera className="w-5 h-5" />
              {t('takePhoto')}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`w-full flex items-center justify-center gap-3 font-medium py-3 px-6 rounded-xl transition-colors border ${
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
                onClick={extractTextFromImage}
                disabled={processing}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {ocrProgress > 0 ? `${ocrProgress}%` : t('processing')}
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
