import type { PurchaseRecord } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { MapPin, Tag, Pencil, Trash2 } from 'lucide-react';

interface PurchaseCardProps {
  purchase: PurchaseRecord;
  onEdit?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
}

export default function PurchaseCard({ purchase, onEdit, onDelete, readOnly }: PurchaseCardProps) {
  const { t } = useLanguage();
  const { isDark } = useTheme();

  const formattedDate = purchase.createdAt instanceof Date
    ? purchase.createdAt.toLocaleDateString('zh-HK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <div className={`rounded-xl border p-4 hover:shadow-md transition-shadow group ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {purchase.itemName}
          </h3>
          <div className="mt-2 space-y-1">
            <div className={`flex items-center gap-1.5 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <Tag className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{purchase.category}</span>
            </div>
            <div className={`flex items-center gap-1.5 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{purchase.location}</span>
            </div>
          </div>
        </div>
        <div className="text-right ml-3">
          <div className={`text-xl font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
            ${purchase.price.toFixed(1)}
          </div>
          <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{formattedDate}</div>
        </div>
      </div>

      {purchase.notes && (
        <p className={`mt-3 text-sm rounded-lg p-2 ${isDark ? 'text-gray-400 bg-gray-700' : 'text-gray-500 bg-gray-50'}`}>
          {purchase.notes}
        </p>
      )}

      {/* Actions */}
      {!readOnly && (onEdit || onDelete) && (
      <div className="mt-3 flex gap-2">
        {onEdit && (
        <button
          onClick={onEdit}
          className={`flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg transition-colors ${
            isDark
              ? 'text-gray-400 hover:text-indigo-400 hover:bg-indigo-900/30'
              : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
          }`}
        >
          <Pencil className="w-3.5 h-3.5" />
          {t('edit')}
        </button>
        )}
        {onDelete && (
        <button
          onClick={onDelete}
          className={`flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg transition-colors ${
            isDark
              ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/30'
              : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t('delete')}
        </button>
        )}
      </div>
      )}
    </div>
  );
}
