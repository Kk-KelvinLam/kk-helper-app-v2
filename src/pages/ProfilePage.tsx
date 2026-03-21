import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  encodeQRData,
  decodeQRData,
  addShare,
  removeShare,
  getMySharedUsers,
  getSharedWithMe,
} from '@/lib/sharing';
import { getUserProfile, saveUserProfile } from '@/lib/userProfile';
import { getUserPurchases } from '@/lib/purchases';
import type { ShareRecord, PurchaseRecord, Gender } from '@/types';
import PurchaseCard from '@/components/PurchaseCard';
import { QrCode, ScanLine, UserMinus, Users, ArrowLeft, Search, Package, Settings } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isDark } = useTheme();

  const [myShares, setMyShares] = useState<ShareRecord[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<ShareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scannerContainerId] = useState(() => 'qr-reader-' + Math.random().toString(36).slice(2));

  // Shared records view
  const [viewingSharedFrom, setViewingSharedFrom] = useState<ShareRecord | null>(null);
  const [sharedRecords, setSharedRecords] = useState<PurchaseRecord[]>([]);
  const [sharedRecordsLoading, setSharedRecordsLoading] = useState(false);
  const [sharedSearchTerm, setSharedSearchTerm] = useState('');
  const [gender, setGender] = useState<Gender>('unspecified');
  const [genderSaving, setGenderSaving] = useState(false);

  const loadShares = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [mySharesList, sharedWithMeList, profile] = await Promise.all([
        getMySharedUsers(user.uid),
        getSharedWithMe(user.uid),
        getUserProfile(user.uid),
      ]);
      setMyShares(mySharesList);
      setSharedWithMe(sharedWithMeList);
      if (profile) setGender(profile.gender);
    } catch (error) {
      console.error('Error loading shares:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  const handleQRScanned = async (decodedText: string) => {
    if (!user) return;

    // Stop scanner
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);

    const scannedUser = decodeQRData(decodedText);
    if (!scannedUser) {
      setMessage({ type: 'error', text: t('shareInvalidQR') });
      return;
    }

    if (scannedUser.uid === user.uid) {
      setMessage({ type: 'error', text: t('shareSelfError') });
      return;
    }

    try {
      // Create bidirectional share: scanned user shares with me, I share with them
      await addShare(
        { uid: scannedUser.uid, displayName: scannedUser.displayName, email: scannedUser.email, photoURL: null },
        user
      );
      await addShare(user, scannedUser);
      setMessage({ type: 'success', text: t('shareSuccess') });
      await loadShares();
    } catch (error) {
      console.error('Error adding share:', error);
      setMessage({ type: 'error', text: t('shareError') });
    }
  };

  const startScanner = async () => {
    setMessage(null);
    setScanning(true);

    // Wait for DOM element to be available
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleQRScanned(decodedText);
        },
        () => {
          // Ignore scan failures (expected while searching)
        }
      );
    } catch (error) {
      console.error('Scanner error:', error);
      setScanning(false);
      setMessage({ type: 'error', text: t('cameraNotAvailable') });
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleRemoveShare = async (shareId: string) => {
    if (!confirm(t('removeShareConfirm'))) return;
    try {
      await removeShare(shareId);
      await loadShares();
    } catch (error) {
      console.error('Error removing share:', error);
    }
  };

  const handleViewSharedRecords = async (share: ShareRecord) => {
    setViewingSharedFrom(share);
    setSharedRecordsLoading(true);
    setSharedSearchTerm('');
    try {
      const records = await getUserPurchases(share.ownerUserId);
      setSharedRecords(records);
    } catch (error) {
      console.error('Error loading shared records:', error);
      setSharedRecords([]);
    } finally {
      setSharedRecordsLoading(false);
    }
  };

  const handleGenderChange = async (newGender: Gender) => {
    if (!user) return;
    setGender(newGender);
    setGenderSaving(true);
    try {
      await saveUserProfile(user.uid, { gender: newGender });
      setMessage({ type: 'success', text: t('profileSaved') });
    } catch (error) {
      console.error('Error saving gender:', error);
      setMessage({ type: 'error', text: t('profileSaveError') });
    } finally {
      setGenderSaving(false);
    }
  };

  // When viewing shared records from another user
  if (viewingSharedFrom) {
    const filteredRecords = sharedRecords.filter((p) => {
      const lower = sharedSearchTerm.toLowerCase();
      return (
        p.itemName.toLowerCase().includes(lower) ||
        p.category.toLowerCase().includes(lower) ||
        p.location.toLowerCase().includes(lower)
      );
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewingSharedFrom(null)}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('sharedRecordsTitle')}
            </h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('sharedRecordsFrom', { name: viewingSharedFrom.ownerDisplayName || viewingSharedFrom.ownerEmail })}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={sharedSearchTerm}
            onChange={(e) => setSharedSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none transition-all ${
              isDark
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                : 'border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
            }`}
          />
        </div>

        {sharedRecordsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-20">
            <Package className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            <h3 className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {sharedSearchTerm ? t('noMatchingRecords') : t('noRecordsYet')}
            </h3>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRecords.map((purchase) => (
              <PurchaseCard
                key={purchase.id}
                purchase={purchase}
                readOnly
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const qrData = user ? encodeQRData(user) : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t('profileTitle')}
        </h1>
      </div>

      {/* User Info */}
      {user && (
        <div className={`rounded-xl border p-4 flex items-center gap-4 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
        }`}>
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName ?? 'User'}
              className={`w-14 h-14 rounded-full border-2 ${isDark ? 'border-gray-600' : 'border-gray-200'}`}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${
              isDark ? 'bg-indigo-900 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
            }`}>
              {(user.displayName ?? user.email ?? 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {user.displayName ?? 'User'}
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {user.email}
            </p>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-xl text-sm ${
          message.type === 'success'
            ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'
            : isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Personal Settings */}
      <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Settings className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('profileSettings')}
          </h2>
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {t('profileGender')}
          </label>
          <div className="flex gap-2">
            {([
              { value: 'male' as Gender, label: t('genderMale') },
              { value: 'female' as Gender, label: t('genderFemale') },
              { value: 'unspecified' as Gender, label: t('genderUnspecified') },
            ]).map((option) => (
              <button
                key={option.value}
                onClick={() => handleGenderChange(option.value)}
                disabled={genderSaving}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                  gender === option.value
                    ? 'bg-indigo-600 text-white'
                    : isDark
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* My QR Code */}
      <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-3">
          <QrCode className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('myQRCode')}
          </h2>
        </div>
        <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {t('myQRCodeHint')}
        </p>
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG value={qrData} size={200} level="M" />
          </div>
        </div>
      </div>

      {/* Scan QR Code */}
      <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-3">
          <ScanLine className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('scanQRCode')}
          </h2>
        </div>
        <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {t('scanQRCodeHint')}
        </p>

        {scanning && (
          <div
            id={scannerContainerId}
            className="mb-4 rounded-xl overflow-hidden"
          />
        )}

        <button
          onClick={scanning ? stopScanner : startScanner}
          className={`w-full py-3 rounded-xl font-medium transition-colors ${
            scanning
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {scanning ? t('stopScanner') : t('startScanner')}
        </button>
      </div>

      {/* Shared With (my shares) */}
      <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Users className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('sharedWithTitle')}
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          </div>
        ) : myShares.length === 0 ? (
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {t('sharedWithEmpty')}
          </p>
        ) : (
          <div className="space-y-3">
            {myShares.map((share) => (
              <div
                key={share.id}
                className={`flex items-center justify-between p-3 rounded-xl ${
                  isDark ? 'bg-gray-700' : 'bg-gray-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {share.sharedWithDisplayName || share.sharedWithEmail}
                  </p>
                  <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {share.sharedWithEmail}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveShare(share.id)}
                  className={`flex items-center gap-1 text-xs py-1.5 px-3 rounded-lg transition-colors ml-2 flex-shrink-0 ${
                    isDark
                      ? 'text-red-400 hover:bg-red-900/30'
                      : 'text-red-500 hover:bg-red-50'
                  }`}
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  {t('removeShare')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shared With Me */}
      <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Users className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('sharedWithMeTitle')}
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          </div>
        ) : sharedWithMe.length === 0 ? (
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {t('sharedWithMeEmpty')}
          </p>
        ) : (
          <div className="space-y-3">
            {sharedWithMe.map((share) => (
              <div
                key={share.id}
                className={`flex items-center justify-between p-3 rounded-xl ${
                  isDark ? 'bg-gray-700' : 'bg-gray-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {share.ownerDisplayName || share.ownerEmail}
                  </p>
                  <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {share.ownerEmail}
                  </p>
                </div>
                <button
                  onClick={() => handleViewSharedRecords(share)}
                  className={`flex items-center gap-1 text-xs py-1.5 px-3 rounded-lg transition-colors ml-2 flex-shrink-0 ${
                    isDark
                      ? 'text-indigo-400 hover:bg-indigo-900/30'
                      : 'text-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  {t('viewSharedRecords')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
