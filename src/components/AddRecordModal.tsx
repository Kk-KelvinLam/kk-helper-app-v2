import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40">
        <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Add Purchase Record</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Item Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Name 物品名稱 *
              </label>
              <input
                type="text"
                required
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                placeholder="e.g. 牛奶 Milk"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price 價格 (HKD) *
              </label>
              <input
                type="number"
                required
                step="0.1"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0.0"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category 類別
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location 地點
              </label>
              <select
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes 備註
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes..."
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            {/* Camera Button */}
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <Camera className="w-5 h-5" />
              Scan Receipt / Price Tag
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
                  Saving...
                </>
              ) : (
                'Save Record'
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
