import { useState } from 'react';
import { getMarketPrices, searchMarketPrices, getMarketPriceCategories, filterByCategory } from '@/lib/marketPrices';
import type { MarketPrice } from '@/types';
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function MarketPricePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部 All');
  const categories = getMarketPriceCategories();

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
        <h1 className="text-2xl font-bold text-gray-900">今日行情</h1>
        <p className="text-gray-500 text-sm mt-1">
          Hong Kong market prices · {today}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
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
          <div
            key={index}
            className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {item.itemName}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{item.source}</p>
              </div>
              <div className="text-right ml-3">
                <div className="text-lg font-bold text-indigo-600">
                  ${item.price.toFixed(1)}
                </div>
                <div className="text-xs text-gray-400">/{item.unit}</div>
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
                  {item.change > 0 ? '+' : ''}${item.change.toFixed(1)} vs yesterday
                </span>
              </div>
            )}
            {item.change === 0 && (
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-400">
                <Minus className="w-3.5 h-3.5" />
                <span>No change</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {prices.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No matching prices found</p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        <p>
          💡 Prices shown are estimated averages for Hong Kong markets and supermarkets.
          Actual prices may vary by location and availability. Data is for reference only.
        </p>
      </div>
    </div>
  );
}
