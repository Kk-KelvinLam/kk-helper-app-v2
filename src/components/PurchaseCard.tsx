import type { PurchaseRecord } from '@/types';
import { MapPin, Tag, Pencil, Trash2 } from 'lucide-react';

interface PurchaseCardProps {
  purchase: PurchaseRecord;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PurchaseCard({ purchase, onEdit, onDelete }: PurchaseCardProps) {
  const formattedDate = purchase.createdAt instanceof Date
    ? purchase.createdAt.toLocaleDateString('zh-HK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {purchase.itemName}
          </h3>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Tag className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{purchase.category}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{purchase.location}</span>
            </div>
          </div>
        </div>
        <div className="text-right ml-3">
          <div className="text-xl font-bold text-indigo-600">
            ${purchase.price.toFixed(1)}
          </div>
          <div className="text-xs text-gray-400 mt-1">{formattedDate}</div>
        </div>
      </div>

      {purchase.notes && (
        <p className="mt-3 text-sm text-gray-500 bg-gray-50 rounded-lg p-2">
          {purchase.notes}
        </p>
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 py-1.5 px-3 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 py-1.5 px-3 rounded-lg hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}
