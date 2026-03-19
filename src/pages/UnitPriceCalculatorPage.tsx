import { useState, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  calculateUnitPrices,
  getBaseUnitLabel,
  SUPPORTED_UNITS,
  type UnitPriceItem,
} from '@/lib/unitPriceCalculator';
import CameraCapture from '@/components/CameraCapture';
import { Plus, Trash2, Trophy, Camera, X } from 'lucide-react';

let nextId = 1;
function createItem(): UnitPriceItem {
  return { id: `item-${nextId++}`, name: '', price: '', quantity: '', unit: 'g' };
}

export default function UnitPriceCalculatorPage() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [items, setItems] = useState<UnitPriceItem[]>([createItem(), createItem()]);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraTargetId, setCameraTargetId] = useState<string | null>(null);

  const results = calculateUnitPrices(items);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, createItem()]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateItem = useCallback(
    (id: string, field: keyof UnitPriceItem, value: string) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  const clearAll = useCallback(() => {
    nextId = 1;
    setItems([createItem(), createItem()]);
  }, []);

  const handleCameraCapture = (id: string) => {
    setCameraTargetId(id);
    setShowCamera(true);
  };

  const handleTextExtracted = (text: string) => {
    if (cameraTargetId) {
      // TODO: Add OCR text parsing to extract price/quantity from price tags
      updateItem(cameraTargetId, 'name', text);
    }
    setShowCamera(false);
    setCameraTargetId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t('calcTitle')}
        </h1>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {t('calcSubtitle')}
        </p>
      </div>

      {/* Items */}
      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`rounded-xl border p-4 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            } ${
              results.find((r) => r.id === item.id)?.isBestDeal
                ? isDark
                  ? 'ring-2 ring-green-500 border-green-500'
                  : 'ring-2 ring-green-500 border-green-400'
                : ''
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                {t('itemLabel', { num: index + 1 })}
              </span>
              <div className="flex items-center gap-2">
                {results.find((r) => r.id === item.id)?.isBestDeal && (
                  <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">
                    <Trophy className="w-3 h-3" />
                    {t('bestDeal')}
                  </span>
                )}
                {items.length > 2 && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isDark
                        ? 'text-gray-500 hover:text-red-400 hover:bg-red-900/30'
                        : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                    }`}
                    title={t('remove')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Product Name */}
              <div className="col-span-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('productName')}
                    value={item.name}
                    onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm outline-none transition-all ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                        : 'border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                    }`}
                  />
                  <button
                    onClick={() => handleCameraCapture(item.id)}
                    className={`p-2 rounded-lg border transition-colors ${
                      isDark
                        ? 'border-gray-600 text-gray-400 hover:text-indigo-400 hover:border-indigo-500 hover:bg-indigo-900/30'
                        : 'border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50'
                    }`}
                    title={t('scanPriceTag')}
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Price */}
              <div>
                <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('price')} ($)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0.00"
                  value={item.price}
                  onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                      : 'border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                  }`}
                />
              </div>

              {/* Quantity + Unit */}
              <div>
                <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('quantity')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                    className={`flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm outline-none transition-all ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                        : 'border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                    }`}
                  />
                  <select
                    value={item.unit}
                    onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                    className={`px-2 py-2 rounded-lg border text-sm outline-none transition-all ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                        : 'bg-white border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                    }`}
                  >
                    {SUPPORTED_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {t(u.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Unit Price Display */}
            {(() => {
              const result = results.find((r) => r.id === item.id);
              if (!result) return null;
              return (
                <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {t('unitPrice')}
                    </span>
                    <span className={`text-sm font-bold ${
                      result.isBestDeal
                        ? 'text-green-600 dark:text-green-400'
                        : isDark ? 'text-indigo-400' : 'text-indigo-600'
                    }`}>
                      ${result.pricePerGram.toFixed(4)}
                      {getBaseUnitLabel(item.unit)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={addItem}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          {t('addItem')}
        </button>
        <button
          onClick={clearAll}
          className={`flex items-center justify-center gap-2 py-3 px-5 rounded-xl border font-medium transition-colors ${
            isDark
              ? 'border-gray-700 text-gray-400 hover:bg-gray-800'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <X className="w-5 h-5" />
          {t('clearAll')}
        </button>
      </div>

      {/* Results Summary */}
      {results.length >= 2 && (
        <div className={`rounded-xl border p-4 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-indigo-50 border-indigo-100'
        }`}>
          <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('results')}
          </h3>
          <div className="space-y-2">
            {results
              .sort((a, b) => a.pricePerGram - b.pricePerGram)
              .map((result, i) => (
                <div
                  key={result.id}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    result.isBestDeal
                      ? isDark
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-green-100 text-green-800'
                      : isDark
                        ? 'text-gray-300'
                        : 'text-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-5 ${
                      result.isBestDeal
                        ? isDark ? 'text-green-400' : 'text-green-700'
                        : isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      #{i + 1}
                    </span>
                    <span className="text-sm font-medium">
                      {result.name || `Item ${i + 1}`}
                    </span>
                    {result.isBestDeal && (
                      <Trophy className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  <span className="text-sm font-mono">
                    ${result.pricePerGram.toFixed(4)}{getBaseUnitLabel(result.unit)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {results.length < 2 && items.length >= 2 && (
        <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <p className="text-sm">{t('addItemHint')}</p>
        </div>
      )}

      {showCamera && (
        <CameraCapture
          onTextExtracted={handleTextExtracted}
          onClose={() => { setShowCamera(false); setCameraTargetId(null); }}
        />
      )}
    </div>
  );
}
