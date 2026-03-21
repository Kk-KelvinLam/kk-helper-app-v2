import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getUserPurchases, deletePurchase } from '@/lib/purchases';
import { getSharedWithMe } from '@/lib/sharing';
import type { PurchaseRecord, ShareRecord } from '@/types';
import AddRecordModal from '@/components/AddRecordModal';
import PurchaseCard from '@/components/PurchaseCard';
import EditRecordModal from '@/components/EditRecordModal';
import { Plus, Search, Package } from 'lucide-react';

export default function RecordsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<ShareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PurchaseRecord | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const loadPurchases = async () => {
    if (!user) return;
    setLoading(true);
    setFetchError(null);
    try {
      const [ownData, sharedUsers] = await Promise.all([
        getUserPurchases(user.uid),
        getSharedWithMe(user.uid),
      ]);
      setSharedWithMe(sharedUsers);

      const sharedRecordsArrays = await Promise.all(
        sharedUsers.map(async (share) => {
          const records = await getUserPurchases(share.ownerUserId);
          return records.map((r) => ({
            ...r,
            ownerDisplayName: share.ownerDisplayName || share.ownerEmail,
          }));
        })
      );

      const allRecords = [
        ...ownData,
        ...sharedRecordsArrays.flat(),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setPurchases(allRecords);
    } catch (error) {
      console.error('Error loading purchases:', error);
      setFetchError(t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      await deletePurchase(id);
      setPurchases((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Error deleting purchase:', error);
    }
  };

  const toggleUserFilter = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const filteredPurchases = purchases.filter((p) => {
    if (selectedUserIds.size > 0) {
      // p.userId is always the record owner's ID (whether it's the current user's own record
      // or a shared record loaded from another user's collection).
      const isOwn = !p.ownerDisplayName;
      if (isOwn && !selectedUserIds.has(user!.uid)) return false;
      if (!isOwn && !selectedUserIds.has(p.userId)) return false;
    }
    const lower = searchTerm.toLowerCase();
    return (
      p.itemName.toLowerCase().includes(lower) ||
      p.category.toLowerCase().includes(lower) ||
      p.location.toLowerCase().includes(lower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('recordsTitle')}</h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('recordsSaved', { count: purchases.length })}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-5 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">{t('addRecord')}</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none transition-all ${
            isDark
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
              : 'border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
          }`}
        />
      </div>

      {/* User Filter Chips */}
      {sharedWithMe.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedUserIds(new Set())}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedUserIds.size === 0
                ? 'bg-indigo-600 text-white'
                : isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('allUsers')}
          </button>
          <button
            onClick={() => toggleUserFilter(user!.uid)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedUserIds.has(user!.uid)
                ? 'bg-indigo-600 text-white'
                : isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('me')}
          </button>
          {sharedWithMe.map((share) => (
            <button
              key={share.id}
              onClick={() => toggleUserFilter(share.ownerUserId)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedUserIds.has(share.ownerUserId)
                  ? 'bg-indigo-600 text-white'
                  : isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {share.ownerDisplayName || share.ownerEmail}
            </button>
          ))}
        </div>
      )}

      {/* Records List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : fetchError ? (
        <div className="text-center py-20">
          <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-500'}`}>{fetchError}</p>
          <button
            onClick={loadPurchases}
            className="mt-4 text-indigo-500 underline text-sm"
          >
            {t('retry')}
          </button>
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className="text-center py-20">
          <Package className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
          <h3 className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {searchTerm ? t('noMatchingRecords') : t('noRecordsYet')}
          </h3>
          <p className={`mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {searchTerm
              ? t('tryDifferentSearch')
              : t('tapAddRecord')}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPurchases.map((purchase) => (
            <PurchaseCard
              key={purchase.id}
              purchase={purchase}
              onEdit={!purchase.ownerDisplayName ? () => setEditingRecord(purchase) : undefined}
              onDelete={!purchase.ownerDisplayName ? () => handleDelete(purchase.id) : undefined}
              readOnly={!!purchase.ownerDisplayName}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddRecordModal
          onClose={() => setShowAddModal(false)}
          onSaved={loadPurchases}
        />
      )}
      {editingRecord && (
        <EditRecordModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSaved={loadPurchases}
        />
      )}
    </div>
  );
}
