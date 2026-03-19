import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';

interface CameraCaptureProps {
  onTextExtracted: (text: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onTextExtracted, onClose }: CameraCaptureProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const extractTextFromImage = async () => {
    if (!imagePreview) return;

    setProcessing(true);
    setError(null);

    try {
      // Simple client-side text extraction using canvas
      // For production, you'd use Tesseract.js or a cloud OCR API
      const img = new Image();
      img.src = imagePreview;
      await new Promise((resolve) => { img.onload = resolve; });

      // Simulate OCR processing
      // In a real implementation, you'd use:
      // import Tesseract from 'tesseract.js';
      // const result = await Tesseract.recognize(imagePreview, 'chi_tra+eng');
      // onTextExtracted(result.data.text);

      // For now, provide a helpful message
      const extractedText = 'Image captured successfully. Please enter item details manually.';
      onTextExtracted(extractedText);
    } catch {
      setError('Failed to process image. Please try again or enter details manually.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">📸 Capture Receipt</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {!imagePreview ? (
          <div className="space-y-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
            >
              <Camera className="w-5 h-5" />
              Take Photo
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-6 rounded-xl transition-colors border border-gray-200"
            >
              <Upload className="w-5 h-5" />
              Upload Image
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-xs text-gray-400 text-center mt-4">
              Take a photo of a receipt or price tag to extract item details
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-gray-200">
              <img
                src={imagePreview}
                alt="Captured"
                className="w-full max-h-64 object-contain bg-gray-50"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setImagePreview(null); setError(null); }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
              >
                Retake
              </button>
              <button
                onClick={extractTextFromImage}
                disabled={processing}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Extract Text'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
