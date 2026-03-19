import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { updatePurchase } from '@/lib/purchases';
import { CATEGORIES, LOCATIONS, type PurchaseRecord, type PurchaseFormData } from '@/types';
import { X, Loader2 } from 'lucide-react';

interface EditRecordModalProps {
  record: PurchaseRecord;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditRecordModal({ record, onClose, onSaved }: EditRecordModalProps) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PurchaseFormData>({
    itemName: record.itemName,
    price: record.price.toString(),
    category: record.category,
    location: record.location,
    notes: record.notes,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.itemName || !form.price) return;

    setSaving(true);
    try {
      await updatePurchase(record.id, form);
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error updating purchase:', error);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `w-full px-4 py-2.5 rounded-xl border outline-none ${
    isDark
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
      : 'border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
  }`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40">
      <div className={`rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('editRecordTitle')}</h2>
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
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 px-4 rounded-xl border font-medium transition-colors ${
                isDark
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !form.itemName || !form.price}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                t('update')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
