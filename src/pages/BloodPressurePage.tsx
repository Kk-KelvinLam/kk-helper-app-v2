import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  addBPRecord,
  deleteBPRecord,
  getUserBPRecords,
  classifyBP,
  getBPCategoryColor,
  analyzeBPRecords,
  getBPNormalDescKey,
} from '@/lib/bloodPressure';
import { getSharedWithMe } from '@/lib/sharing';
import { parseBPText } from '@/lib/ocrParser';
import CameraCapture from '@/components/CameraCapture';
import type { BloodPressureRecord, BloodPressureFormData, BPCategory, Gender, ShareRecord } from '@/types';
import type { TranslationKeys } from '@/i18n';
import { getUserProfile } from '@/lib/userProfile';
import {
  Plus,
  Heart,
  Activity,
  Trash2,
  Info,
  BarChart3,
  TrendingUp,
  Camera,
  X,
  Loader2,
  Eye,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

function BPHistoryChart({
  records,
  isDark,
  t,
  locale,
}: {
  records: BloodPressureRecord[];
  isDark: boolean;
  t: (key: TranslationKeys, params?: Record<string, string | number>) => string;
  locale: string;
}) {
  if (records.length < 2) return null;

  const sorted = [...records].sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime()).slice(-14);
  const systolicValues = sorted.map((r) => r.systolic);
  const diastolicValues = sorted.map((r) => r.diastolic);
  const allValues = [...systolicValues, ...diastolicValues];
  const minVal = Math.min(...allValues) - 10;
  const maxVal = Math.max(...allValues) + 10;
  const range = maxVal - minVal || 1;
  const chartHeight = 160;
  const chartWidth = 320;
  const padding = 35;
  const plotWidth = chartWidth - padding * 2;
  const plotHeight = chartHeight - 30;
  const divisor = sorted.length > 1 ? sorted.length - 1 : 1;

  const sysPoints = sorted.map((r, i) => ({
    x: padding + (i / divisor) * plotWidth,
    y: chartHeight - 20 - ((r.systolic - minVal) / range) * plotHeight,
    value: r.systolic,
    date: r.measuredAt,
  }));

  const diaPoints = sorted.map((r, i) => ({
    x: padding + (i / divisor) * plotWidth,
    y: chartHeight - 20 - ((r.diastolic - minVal) / range) * plotHeight,
    value: r.diastolic,
    date: r.measuredAt,
  }));

  const sysPath = sysPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const diaPath = diaPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = chartHeight - 20 - ratio * plotHeight;
          const value = minVal + ratio * range;
          return (
            <g key={ratio}>
              <line x1={padding} y1={y} x2={chartWidth - padding} y2={y}
                stroke={isDark ? '#374151' : '#e5e7eb'} strokeDasharray="4,4" />
              <text x={padding - 4} y={y + 3} textAnchor="end"
                fill={isDark ? '#9ca3af' : '#9ca3af'} fontSize="7">
                {Math.round(value)}
              </text>
            </g>
          );
        })}
        {/* Systolic line */}
        <path d={sysPath} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Diastolic line */}
        <path d={diaPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Points */}
        {sysPoints.map((p, i) => (
          <circle key={`s-${i}`} cx={p.x} cy={p.y} r="2.5" fill="#ef4444" />
        ))}
        {diaPoints.map((p, i) => (
          <circle key={`d-${i}`} cx={p.x} cy={p.y} r="2.5" fill="#3b82f6" />
        ))}
        {/* Date labels */}
        {sorted.map((r, i) => {
          if (sorted.length > 7 && i % 2 !== 0) return null;
          const x = padding + (i / divisor) * plotWidth;
          return (
            <text key={`label-${i}`} x={x} y={chartHeight - 5} textAnchor="middle"
              fill={isDark ? '#9ca3af' : '#9ca3af'} fontSize="6">
              {r.measuredAt.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' })}
            </text>
          );
        })}
      </svg>
      <div className="flex justify-center gap-6 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-red-500 rounded" />
          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('bpSystolic')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-blue-500 rounded" />
          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('bpDiastolic')}</span>
        </div>
      </div>
    </div>
  );
}

export default function BloodPressurePage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isDark } = useTheme();

  const [records, setRecords] = useState<BloodPressureRecord[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<ShareRecord[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRangeRef, setShowRangeRef] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [userGender, setUserGender] = useState<Gender>('unspecified');
  const [showCamera, setShowCamera] = useState(false);
  const [ocrFilled, setOcrFilled] = useState(false);

  // Form state
  const [formData, setFormData] = useState<BloodPressureFormData>({
    systolic: '',
    diastolic: '',
    heartRate: '',
    arm: 'left',
    position: 'sitting',
    notes: '',
    imageUrl: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRecords = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [data, profile, sharedUsers] = await Promise.all([
        getUserBPRecords(user.uid),
        getUserProfile(user.uid),
        getSharedWithMe(user.uid),
      ]);
      setSharedWithMe(sharedUsers);
      if (profile) setUserGender(profile.gender);

      const sharedRecordsArrays = await Promise.all(
        sharedUsers.map(async (share) => {
          const sharedRecords = await getUserBPRecords(share.ownerUserId);
          return sharedRecords.map((r) => ({
            ...r,
            ownerDisplayName: share.ownerDisplayName || share.ownerEmail,
          }));
        })
      );

      const allRecords = [
        ...data,
        ...sharedRecordsArrays.flat(),
      ].sort((a, b) => b.measuredAt.getTime() - a.measuredAt.getTime());

      setRecords(allRecords);
    } catch (err) {
      console.error('Error loading BP records:', err);
      setError(t('bpLoadError'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const resetForm = () => {
    setFormData({
      systolic: '',
      diastolic: '',
      heartRate: '',
      arm: 'left',
      position: 'sitting',
      notes: '',
      imageUrl: '',
    });
    setOcrFilled(false);
    setSaveError(null);
  };

  const handleBPTextExtracted = (text: string) => {
    try {
      const parsed = parseBPText(text);
      setFormData((prev) => ({
        ...prev,
        systolic: parsed.systolic || prev.systolic,
        diastolic: parsed.diastolic || prev.diastolic,
        heartRate: parsed.heartRate || prev.heartRate,
      }));
      if (parsed.systolic || parsed.diastolic || parsed.heartRate) {
        setOcrFilled(true);
      }
    } catch (err) {
      console.error('Error parsing BP text:', err);
    }
    setShowCamera(false);
  };

  const handleBPImageCaptured = (imageDataUrl: string) => {
    setFormData((prev) => ({ ...prev, imageUrl: imageDataUrl }));
  };

  const handleSave = async () => {
    if (!user || !formData.systolic || !formData.diastolic || !formData.heartRate) return;
    setSaving(true);
    setSaveError(null);
    try {
      // TODO: Upload imageUrl to Firebase Storage once configured; for now, strip
      // base64 data URLs to avoid exceeding Firestore's 1 MB document size limit.
      const dataToSave: BloodPressureFormData = {
        ...formData,
        imageUrl: formData.imageUrl.startsWith('data:') ? '' : formData.imageUrl,
      };
      await addBPRecord(user.uid, dataToSave);
      setShowAddModal(false);
      resetForm();
      await loadRecords();
    } catch (err) {
      console.error('Error saving BP record:', err);
      setSaveError(t('bpSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('bpDeleteConfirm'))) return;
    try {
      await deleteBPRecord(id);
      await loadRecords();
    } catch (err) {
      console.error('Error deleting BP record:', err);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData((prev) => ({ ...prev, imageUrl: event.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const getCategoryLabel = (cat: BPCategory): string => {
    switch (cat) {
      case 'normal': return t('bpNormal');
      case 'elevated': return t('bpElevated');
      case 'hypertension1': return t('bpHypertension1');
      case 'hypertension2': return t('bpHypertension2');
      case 'crisis': return t('bpCrisis');
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

  const filteredRecords = records.filter((r) => {
    if (selectedUserIds.size > 0) {
      const isOwn = !r.ownerDisplayName;
      if (isOwn && !selectedUserIds.has(user!.uid)) return false;
      if (!isOwn && !selectedUserIds.has(r.userId)) return false;
    }
    return true;
  });

  const analysis = analyzeBPRecords(filteredRecords);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('bpTitle')}</h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('bpSubtitle')}
            {filteredRecords.length > 0 && ` · ${t('bpRecordsSaved', { count: filteredRecords.length })}`}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          {t('bpAddRecord')}
        </button>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setShowRangeRef(!showRangeRef)}
          className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            showRangeRef
              ? 'bg-indigo-600 text-white'
              : isDark ? 'bg-gray-800 text-gray-300 border border-gray-700' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          <Info className="w-4 h-4" />
          {t('bpNormalRange')}
        </button>
        <button
          onClick={() => setShowChart(!showChart)}
          className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            showChart
              ? 'bg-indigo-600 text-white'
              : isDark ? 'bg-gray-800 text-gray-300 border border-gray-700' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          {t('bpHistory')}
        </button>
        <button
          onClick={() => setShowAnalysis(!showAnalysis)}
          className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            showAnalysis
              ? 'bg-indigo-600 text-white'
              : isDark ? 'bg-gray-800 text-gray-300 border border-gray-700' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          {t('bpAnalysis')}
        </button>
      </div>

      {/* Normal Range Reference */}
      {showRangeRef && (
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('bpNormalRange')}</h3>
          <div className="space-y-2">
            {([
              { key: 'normal' as BPCategory, label: t('bpNormal'), desc: t(getBPNormalDescKey(userGender)) },
              { key: 'elevated' as BPCategory, label: t('bpElevated'), desc: t('bpElevatedDesc') },
              { key: 'hypertension1' as BPCategory, label: t('bpHypertension1'), desc: t('bpHypertension1Desc') },
              { key: 'hypertension2' as BPCategory, label: t('bpHypertension2'), desc: t('bpHypertension2Desc') },
              { key: 'crisis' as BPCategory, label: t('bpCrisis'), desc: t('bpCrisisDesc') },
            ]).map((item) => (
              <div key={item.key} className={`flex items-center gap-3 p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getBPCategoryColor(item.key) }} />
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{item.label}</span>
                  <span className={`text-sm ml-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
          {userGender !== 'unspecified' && (
            <p className={`text-xs mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {t('bpGenderNote', { gender: userGender === 'male' ? t('genderMale') : t('genderFemale') })}
            </p>
          )}
        </div>
      )}

      {/* History Chart */}
      {showChart && (
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('bpHistory')}</h3>
          {filteredRecords.length < 2 ? (
            <p className={`text-sm text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {t('bpTapAdd')}
            </p>
          ) : (
            <BPHistoryChart records={filteredRecords} isDark={isDark} t={t} locale={language} />
          )}
        </div>
      )}

      {/* Analysis */}
      {showAnalysis && analysis && (
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('bpAnalysis')}</h3>

          {/* Overall Status */}
          <div className={`p-3 rounded-xl mb-4 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getBPCategoryColor(analysis.overallCategory) }} />
              <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('bpOverallStatus')}: {getCategoryLabel(analysis.overallCategory)}
              </span>
            </div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('bpTotalRecords', { count: analysis.totalRecords })}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className={`p-3 rounded-xl text-center ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <p className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('bpSystolic')}</p>
              <p className="text-lg font-bold text-red-500">{analysis.avgSystolic}</p>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {analysis.minSystolic}-{analysis.maxSystolic}
              </p>
            </div>
            <div className={`p-3 rounded-xl text-center ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <p className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('bpDiastolic')}</p>
              <p className="text-lg font-bold text-blue-500">{analysis.avgDiastolic}</p>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {analysis.minDiastolic}-{analysis.maxDiastolic}
              </p>
            </div>
            <div className={`p-3 rounded-xl text-center ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <p className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('bpHeartRate')}</p>
              <p className={`text-lg font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{analysis.avgHeartRate}</p>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {analysis.minHeartRate}-{analysis.maxHeartRate}
              </p>
            </div>
          </div>

          {/* Category Distribution */}
          <div>
            <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('bpCategoryDistribution')}</p>
            <div className="space-y-1.5">
              {(Object.entries(analysis.categoryCount) as [BPCategory, number][])
                .filter(([, count]) => count > 0)
                .map(([cat, count]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getBPCategoryColor(cat) }} />
                    <span className={`text-sm flex-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{getCategoryLabel(cat)}</span>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-200'}`} style={{ width: '80px' }}>
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${(count / analysis.totalRecords) * 100}%`,
                            backgroundColor: getBPCategoryColor(cat),
                          }}
                        />
                      </div>
                      <span className={`text-xs min-w-[2rem] text-right ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {showAnalysis && !analysis && (
        <div className={`rounded-xl border p-4 text-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('bpNoRecords')}</p>
        </div>
      )}

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

      {/* Error */}
      {error && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'}`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={loadRecords} className="ml-auto text-sm underline">{t('retry')}</button>
        </div>
      )}

      {/* Records List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-20">
          <Heart className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
          <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {t('bpNoRecords')}
          </h3>
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {t('bpTapAdd')}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecords.map((record) => {
            const cat = classifyBP(record.systolic, record.diastolic);
            const catColor = getBPCategoryColor(cat);
            const isSharedRecord = !!record.ownerDisplayName;
            return (
              <div
                key={record.id}
                className={`rounded-xl border p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: catColor }} />
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: catColor + '20', color: catColor }}>
                      {getCategoryLabel(cat)}
                    </span>
                  </div>
                  {!isSharedRecord && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(record.id)}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {isSharedRecord && (
                  <p className={`text-xs mb-2 truncate ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    {t('sharedBy', { name: record.ownerDisplayName! })}
                  </p>
                )}

                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {record.systolic}/{record.diastolic}
                  </span>
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('bpMmHg')}</span>
                </div>

                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-1">
                    <Activity className={`w-3.5 h-3.5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                    <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {record.heartRate} {t('bpBPM')}
                    </span>
                  </div>
                </div>

                <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <span>{record.arm === 'left' ? t('bpArmLeft') : t('bpArmRight')}</span>
                  <span>·</span>
                  <span>
                    {record.position === 'sitting' ? t('bpPositionSitting') :
                     record.position === 'standing' ? t('bpPositionStanding') : t('bpPositionLying')}
                  </span>
                </div>

                <div className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {record.measuredAt.toLocaleString(language, {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </div>

                {record.notes && (
                  <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {record.notes}
                  </p>
                )}

                {record.imageUrl && (
                  <button
                    onClick={() => setViewingPhoto(record.imageUrl)}
                    className={`flex items-center gap-1 text-xs mt-2 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {t('bpViewPhoto')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Record Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('bpAddRecord')}</h2>
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Systolic */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('bpSystolic')} ({t('bpMmHg')})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.systolic}
                  onChange={(e) => setFormData((prev) => ({ ...prev, systolic: e.target.value.replace(/\D/g, '') }))}
                  placeholder="120"
                  className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500'
                      : 'border-gray-200 focus:ring-2 focus:ring-indigo-500'
                  }`}
                />
              </div>

              {/* Diastolic */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('bpDiastolic')} ({t('bpMmHg')})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.diastolic}
                  onChange={(e) => setFormData((prev) => ({ ...prev, diastolic: e.target.value.replace(/\D/g, '') }))}
                  placeholder="80"
                  className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500'
                      : 'border-gray-200 focus:ring-2 focus:ring-indigo-500'
                  }`}
                />
              </div>

              {/* Heart Rate */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('bpHeartRate')} ({t('bpBPM')})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.heartRate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, heartRate: e.target.value.replace(/\D/g, '') }))}
                  placeholder="72"
                  className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500'
                      : 'border-gray-200 focus:ring-2 focus:ring-indigo-500'
                  }`}
                />
              </div>

              {/* Arm & Position */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('bpArm')}
                  </label>
                  <select
                    value={formData.arm}
                    onChange={(e) => setFormData((prev) => ({ ...prev, arm: e.target.value as 'left' | 'right' }))}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'border-gray-200'
                    }`}
                  >
                    <option value="left">{t('bpArmLeft')}</option>
                    <option value="right">{t('bpArmRight')}</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('bpPosition')}
                  </label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData((prev) => ({ ...prev, position: e.target.value as 'sitting' | 'standing' | 'lying' }))}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'border-gray-200'
                    }`}
                  >
                    <option value="sitting">{t('bpPositionSitting')}</option>
                    <option value="standing">{t('bpPositionStanding')}</option>
                    <option value="lying">{t('bpPositionLying')}</option>
                  </select>
                </div>
              </div>

              {/* Photo */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('bpPhoto')}
                </label>
                {formData.imageUrl ? (
                  <div className="relative">
                    <img src={formData.imageUrl} alt="BP reading" className={`w-full max-h-40 object-contain rounded-xl ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`} />
                    <button
                      onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
                      className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border transition-colors ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                    {t('bpUploadPhoto')}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              {/* Notes */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('bpNotes')}
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder={t('bpNotesPlaceholder')}
                  rows={2}
                  className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all resize-none ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500'
                      : 'border-gray-200 focus:ring-2 focus:ring-indigo-500'
                  }`}
                />
              </div>

              {/* OCR fill confirmation */}
              {ocrFilled && (
                <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700'}`}>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  {t('ocrFieldsFilled')}
                </div>
              )}

              {/* Scan BP Monitor */}
              <button
                type="button"
                onClick={() => { setOcrFilled(false); setShowCamera(true); }}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed transition-colors ${
                  isDark
                    ? 'border-gray-600 text-gray-400 hover:border-indigo-500 hover:text-indigo-400 hover:bg-indigo-900/20'
                    : 'border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <Camera className="w-5 h-5" />
                {t('bpScanReading')}
              </button>

              {/* Live Preview */}
              {formData.systolic && formData.diastolic && (
                <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getBPCategoryColor(classifyBP(parseInt(formData.systolic) || 0, parseInt(formData.diastolic) || 0)) }}
                    />
                    <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                      {getCategoryLabel(classifyBP(parseInt(formData.systolic) || 0, parseInt(formData.diastolic) || 0))}
                    </span>
                  </div>
                </div>
              )}

              {/* Save Error */}
              {saveError && (
                <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'}`}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {saveError}
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={saving || !formData.systolic || !formData.diastolic || !formData.heartRate}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('bpSaving')}
                  </>
                ) : (
                  t('bpSaveRecord')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {viewingPhoto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setViewingPhoto(null)}>
          <div className="max-w-lg w-full">
            <img src={viewingPhoto} alt="BP reading" className="w-full rounded-xl" />
            <button
              onClick={() => setViewingPhoto(null)}
              className="mt-4 w-full py-2.5 rounded-xl bg-white/20 text-white font-medium"
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}

      {/* Camera Capture for BP */}
      {showCamera && (
        <CameraCapture
          onTextExtracted={handleBPTextExtracted}
          onImageCaptured={handleBPImageCaptured}
          onClose={() => setShowCamera(false)}
          title={t('bpScanReading')}
          hint={t('bpCaptureHint')}
        />
      )}
    </div>
  );
}
