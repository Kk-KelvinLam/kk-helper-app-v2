import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import Tesseract from 'tesseract.js';

interface CameraCaptureProps {
  onTextExtracted: (text: string) => void;
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
}

type CameraState = 'idle' | 'streaming' | 'preview';

export default function CameraCapture({ onTextExtracted, onImageCaptured, onClose, title, hint, ocrLanguage, preprocessImage, ocrParams }: CameraCaptureProps) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setError(null);

    try {
      // Optionally preprocess the image (e.g. contrast enhancement for LCD displays)
      const ocrInput = preprocessImage ? await preprocessImage(imagePreview) : imagePreview;
      const lang = ocrLanguage || 'eng+chi_tra';

      let text: string;
      if (ocrParams) {
        // Use a Tesseract worker for fine-grained configuration (PSM mode, etc.)
        const worker = await Tesseract.createWorker(lang);
        await worker.setParameters(ocrParams);
        const result = await worker.recognize(ocrInput);
        text = result.data.text.trim();
        await worker.terminate();
      } else {
        const result = await Tesseract.recognize(ocrInput, lang);
        text = result.data.text.trim();
      }

      if (onImageCaptured) {
        onImageCaptured(imagePreview);
      }
      onTextExtracted(text || t('noTextDetected'));
    } catch {
      setError(t('imageProcessError'));
    } finally {
      setProcessing(false);
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
                    {t('processing')}
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
