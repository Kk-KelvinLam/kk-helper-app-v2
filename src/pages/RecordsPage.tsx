import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserPurchases, deletePurchase } from '@/lib/purchases';
import type { PurchaseRecord } from '@/types';
import AddRecordModal from '@/components/AddRecordModal';
import PurchaseCard from '@/components/PurchaseCard';
import EditRecordModal from '@/components/EditRecordModal';
import { Plus, Search, Package } from 'lucide-react';

export default function RecordsPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PurchaseRecord | null>(null);

  const loadPurchases = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getUserPurchases(user.uid);
      setPurchases(data);
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      await deletePurchase(id);
      setPurchases((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Error deleting purchase:', error);
    }
  };

  const filteredPurchases = purchases.filter((p) => {
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
          <h1 className="text-2xl font-bold text-gray-900">購物紀錄</h1>
          <p className="text-gray-500 text-sm mt-1">
            {purchases.length} records saved
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-5 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Add Record</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search items, categories, or locations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
        />
      </div>

      {/* Records List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600">
            {searchTerm ? 'No matching records' : 'No records yet'}
          </h3>
          <p className="text-gray-400 mt-1">
            {searchTerm
              ? 'Try a different search term'
              : 'Tap "Add Record" to start tracking prices'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPurchases.map((purchase) => (
            <PurchaseCard
              key={purchase.id}
              purchase={purchase}
              onEdit={() => setEditingRecord(purchase)}
              onDelete={() => handleDelete(purchase.id)}
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
