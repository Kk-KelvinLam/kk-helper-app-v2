import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getMarketPrices, searchMarketPrices, getMarketPriceCategories, filterByCategory, getMarketPriceHistory, refreshMarketPrices } from '@/lib/marketPrices';
import type { MarketPrice } from '@/types';
import { Search, TrendingUp, TrendingDown, Minus, X, RefreshCw, Wifi, WifiOff } from 'lucide-react';

function PriceHistoryChart({ history, isDark }: { history: { date: string; price: number }[]; isDark: boolean }) {
  if (history.length === 0) return null;

  const prices = history.map((h) => h.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;
  const chartHeight = 120;
  const chartWidth = 280;
  const padding = 30;
  const plotWidth = chartWidth - padding * 2;
  const plotHeight = chartHeight - 20;

  const divisor = history.length > 1 ? history.length - 1 : 1;
  const points = history.map((h, i) => {
    const x = padding + (i / divisor) * plotWidth;
    const y = chartHeight - 10 - ((h.price - minPrice) / range) * plotHeight;
    return { x, y, price: h.price, date: h.date };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full max-w-xs mx-auto">
      {/* Grid lines */}
      {[0, 0.5, 1].map((ratio) => {
        const y = chartHeight - 10 - ratio * plotHeight;
        const price = minPrice + ratio * range;
        return (
          <g key={ratio}>
            <line x1={padding} y1={y} x2={chartWidth - padding} y2={y}
              stroke={isDark ? '#374151' : '#e5e7eb'} strokeDasharray="4,4" />
            <text x={padding - 4} y={y + 3} textAnchor="end"
              fill={isDark ? '#9ca3af' : '#9ca3af'} fontSize="7">
              ${price.toFixed(0)}
            </text>
          </g>
        );
      })}
      {/* Line */}
      <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#6366f1" />
          <text x={p.x} y={chartHeight - 1} textAnchor="middle"
            fill={isDark ? '#9ca3af' : '#9ca3af'} fontSize="6">
            {p.date.slice(5)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function MarketPricePage() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部 All');
  const [selectedItem, setSelectedItem] = useState<MarketPrice | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLiveData, setIsLiveData] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const categories = getMarketPriceCategories();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { isLive } = await refreshMarketPrices();
      setIsLiveData(isLive);
      setLastUpdated(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Attempt a refresh on first mount
  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  let prices: MarketPrice[];
  if (searchTerm) {
    prices = searchMarketPrices(searchTerm);
  } else {
    prices = selectedCategory === '全部 All'
      ? getMarketPrices()
      : filterByCategory(selectedCategory);
  }

  const today = new Date().toLocaleDateString('zh-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('marketTitle')}</h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('marketSubtitle')} · {today}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`p-2 rounded-lg transition-colors mt-1 ${
              isDark
                ? 'text-gray-400 hover:text-indigo-400 hover:bg-gray-700 disabled:opacity-40'
                : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-100 disabled:opacity-40'
            }`}
            title={t('refreshPrices')}
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {lastUpdated && (
          <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {isLiveData ? (
              <Wifi className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span>
              {isLiveData ? t('liveData') : t('staticData')}
              {' · '}
              {t('lastUpdated')}: {lastUpdated.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
        <input
          type="text"
          placeholder={t('searchItems')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none transition-all ${
            isDark
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
              : 'border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
          }`}
        />
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => { setSelectedCategory(cat); setSearchTerm(''); }}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat && !searchTerm
                ? 'bg-indigo-600 text-white'
                : isDark
                  ? 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Price Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {prices.map((item, index) => (
          <button
            key={index}
            onClick={() => setSelectedItem(item)}
            className={`text-left rounded-xl border p-4 hover:shadow-md transition-shadow ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {item.itemName}
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{item.source}</p>
              </div>
              <div className="text-right ml-3">
                <div className={`text-lg font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  ${item.price.toFixed(1)}
                </div>
                <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>/{item.unit}</div>
              </div>
            </div>
            {item.change !== undefined && item.change !== 0 && (
              <div
                className={`mt-3 flex items-center gap-1 text-xs font-medium ${
                  item.change > 0 ? 'text-red-500' : 'text-green-500'
                }`}
              >
                {item.change > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                <span>
                  {item.change > 0 ? '+' : ''}${item.change.toFixed(1)} {t('vsYesterday')}
                </span>
              </div>
            )}
            {item.change === 0 && (
              <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <Minus className="w-3.5 h-3.5" />
                <span>{t('noChange')}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {prices.length === 0 && (
        <div className="text-center py-12">
          <p className={isDark ? 'text-gray-500' : 'text-gray-500'}>{t('noMatchingPrices')}</p>
        </div>
      )}

      {/* Disclaimer */}
      <div className={`rounded-xl p-4 text-sm border ${isDark ? 'bg-amber-900/20 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
        <p>{t('marketDisclaimer')}</p>
      </div>

      {/* Price History Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl max-w-md w-full p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {selectedItem.itemName}
                </h2>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('priceHistory')}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>

            <div className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <PriceHistoryChart history={getMarketPriceHistory(selectedItem.itemName)} isDark={isDark} />
            </div>

            <div className={`text-center text-lg font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
              {t('price')}: ${selectedItem.price.toFixed(1)}/{selectedItem.unit}
            </div>

            <button
              onClick={() => setSelectedItem(null)}
              className={`w-full mt-4 py-2.5 rounded-xl font-medium transition-colors ${
                isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
