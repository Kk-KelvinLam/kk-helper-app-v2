import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { addPurchase } from '@/lib/purchases';
import { CATEGORIES, LOCATIONS, type PurchaseFormData } from '@/types';
import CameraCapture from './CameraCapture';
import { X, Camera, Loader2 } from 'lucide-react';

interface AddRecordModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export default function AddRecordModal({ onClose, onSaved }: AddRecordModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [saving, setSaving] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [form, setForm] = useState<PurchaseFormData>({
    itemName: '',
    price: '',
    category: CATEGORIES[0],
    location: LOCATIONS[0],
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.itemName || !form.price) return;

    setSaving(true);
    try {
      await addPurchase(user.uid, form);
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error adding purchase:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTextExtracted = (text: string) => {
    setForm((prev) => ({ ...prev, notes: text }));
    setShowCamera(false);
  };

  const inputClass = `w-full px-4 py-2.5 rounded-xl border outline-none ${
    isDark
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
      : 'border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
  }`;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40">
        <div className={`rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('addPurchaseTitle')}</h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Item Name */}
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('itemName')} *
              </label>
              <input
                type="text"
                required
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                placeholder={t('itemNamePlaceholder')}
                className={inputClass}
              />
            </div>

            {/* Price */}
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('priceHKD')} *
              </label>
              <input
                type="number"
                required
                step="0.1"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0.0"
                className={inputClass}
              />
            </div>

            {/* Category */}
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('category')}
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={`${inputClass} ${isDark ? 'bg-gray-700' : 'bg-white'}`}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('location')}
              </label>
              <select
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className={`${inputClass} ${isDark ? 'bg-gray-700' : 'bg-white'}`}
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('notes')}
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t('notesPlaceholder')}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Camera Button */}
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed transition-colors ${
                isDark
                  ? 'border-gray-600 text-gray-400 hover:border-indigo-500 hover:text-indigo-400 hover:bg-indigo-900/20'
                  : 'border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              <Camera className="w-5 h-5" />
              {t('scanReceipt')}
            </button>

            {/* Submit */}
            <button
              type="submit"
              disabled={saving || !form.itemName || !form.price}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                t('saveRecord')
              )}
            </button>
          </form>
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          onTextExtracted={handleTextExtracted}
          onClose={() => setShowCamera(false)}
        />
      )}
    </>
  );
}
