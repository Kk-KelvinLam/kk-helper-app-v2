import type { MarketPrice } from '@/types';

// ---------------------------------------------------------------------------
// Static reference data
// Used as fallback when the live API is unavailable and as baseline estimates.
// ---------------------------------------------------------------------------

// Simulated market prices for common items in Hong Kong
const HK_MARKET_PRICES: MarketPrice[] = [
  // Vegetables
  { itemName: '菜心 Choi Sum', price: 12.0, unit: '斤/catty', source: '街市平均價', date: new Date().toISOString().split('T')[0], change: -0.5 },
  { itemName: '白菜 Bok Choy', price: 10.0, unit: '斤/catty', source: '街市平均價', date: new Date().toISOString().split('T')[0], change: 0.0 },
  { itemName: '番茄 Tomato', price: 15.0, unit: '斤/catty', source: '街市平均價', date: new Date().toISOString().split('T')[0], change: 1.0 },
  { itemName: '薯仔 Potato', price: 8.0, unit: '斤/catty', source: '街市平均價', date: new Date().toISOString().split('T')[0], change: -0.5 },
  { itemName: '洋蔥 Onion', price: 7.0, unit: '斤/catty', source: '街市平均價', date: new Date().toISOString().split('T')[0], change: 0.0 },
  { itemName: '西蘭花 Broccoli', price: 18.0, unit: '斤/catty', source: '街市平均價', date: new Date().toISOString().split('T')[0], change: 2.0 },

  // Fruits
  { itemName: '蘋果 Apple', price: 25.0, unit: '斤/catty', source: '超市平均價', date: new Date().toISOString().split('T')[0], change: -1.0 },
  { itemName: '橙 Orange', price: 20.0, unit: '斤/catty', source: '超市平均價', date: new Date().toISOString().split('T')[0], change: 0.5 },
  { itemName: '香蕉 Banana', price: 12.0, unit: '斤/catty', source: '超市平均價', date: new Date().toISOString().split('T')[0], change: 0.0 },
  { itemName: '提子 Grapes', price: 35.0, unit: '斤/catty', source: '超市平均價', date: new Date().toISOString().split('T')[0], change: -2.0 },

  // Meat
  { itemName: '豬肉(瘦) Lean Pork', price: 48.0, unit: '斤/catty', source: '街市平均價', date: new Date().toISOString().split('T')[0], change: 1.0 },
  { itemName: '雞腿 Chicken Leg', price: 28.0, unit: '斤/catty', source: '街市平均價', date: new Date().toISOString().split('T')[0], change: 0.0 },
  { itemName: '牛肉 Beef', price: 80.0, unit: '斤/catty', source: '街市平均價', date: new Date().toISOString().split('T')[0], change: 3.0 },
  { itemName: '排骨 Spare Ribs', price: 55.0, unit: '斤/catty', source: '街市平均價', date: new Date().toISOString().split('T')[0], change: -1.0 },

  // Seafood
  { itemName: '鯇魚 Grass Carp', price: 35.0, unit: '斤/catty', source: '街市平均價', date: new Date().toISOString().split('T')[0], change: 0.0 },
  { itemName: '蝦 Shrimp', price: 65.0, unit: '斤/catty', source: '街市平均價', date: new Date().toISOString().split('T')[0], change: 5.0 },

  // Dairy
  { itemName: '鮮奶 Fresh Milk (1L)', price: 22.0, unit: '支/bottle', source: '超市平均價', date: new Date().toISOString().split('T')[0], change: 0.0 },
  { itemName: '雞蛋 Eggs (10pcs)', price: 25.0, unit: '盒/box', source: '超市平均價', date: new Date().toISOString().split('T')[0], change: -1.0 },

  // Staples
  { itemName: '白米 Rice (5kg)', price: 58.0, unit: '包/pack', source: '超市平均價', date: new Date().toISOString().split('T')[0], change: 0.0 },
  { itemName: '麵包 Bread', price: 15.0, unit: '包/pack', source: '超市平均價', date: new Date().toISOString().split('T')[0], change: 0.5 },
];

// ---------------------------------------------------------------------------
// Live data source – HK data.gov.hk open data API
// ---------------------------------------------------------------------------
//
// Research findings:
//   The Hong Kong government's open data portal (data.gov.hk) provides several
//   datasets relevant to retail food prices:
//
//   1. Vegetable Marketing Organization (蔬菜統營處) daily wholesale prices
//      Dataset ID: "@amo_vmo_wholesale_vegetable_prices"
//      API endpoint (v2 filter):
//        https://api.data.gov.hk/v2/filter?q={"resource":"http://www.fehd.gov.hk/english/statistics/statistics_data/MarketsStatisticsData/vegetables","section":0,"format":"json"}
//
//   2. Census and Statistics Department – Consumer Price Index (CPI)
//      Contains food sub-indices (base year 2019/20 = 100)
//      Useful for tracking price-change trends rather than absolute prices.
//      https://www.censtatd.gov.hk/en/page_r1050.html
//
//   3. FEHD wet-market stall data (store addresses but not live prices)
//
// Implementation strategy:
//   • Use the data.gov.hk v2 API to fetch VMO wholesale vegetable prices.
//   • Map the wholesale item codes to the display names in HK_MARKET_PRICES.
//   • Fall back to HK_MARKET_PRICES if the API is unreachable or returns an error.
//   • Cache the fetched data for CACHE_TTL_MS to avoid repeated requests.
//
// Note: As of 2026-03, the VMO wholesale price API does not expose a public
// CORS-friendly JSON endpoint that can be called directly from the browser.
// A lightweight serverless function (e.g. Firebase Cloud Function) would be
// needed to proxy the request in production.  The code below is structured to
// slot in a real API URL when one becomes available or a proxy is deployed.

const LIVE_PRICE_API_URL = import.meta.env.VITE_MARKET_PRICE_API_URL as string | undefined;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface LivePriceRecord {
  itemName: string;
  price: number;
  unit: string;
  source: string;
  date: string;
}

let cachedPrices: MarketPrice[] | null = null;
let cacheTimestamp = 0;
let cacheIsLive = false;

/**
 * Attempt to fetch live market prices from the configured API URL.
 * The expected JSON shape is an array of LivePriceRecord objects.
 * Returns null on any error so the caller can fall back to static data.
 */
async function fetchLivePrices(): Promise<MarketPrice[] | null> {
  if (!LIVE_PRICE_API_URL) return null;

  try {
    const res = await fetch(LIVE_PRICE_API_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const records: LivePriceRecord[] = await res.json();
    if (!Array.isArray(records) || records.length === 0) return null;

    const today = new Date().toISOString().split('T')[0];
    return records.map((r) => ({
      itemName: r.itemName,
      price: Number(r.price),
      unit: r.unit,
      source: r.source || '市場數據',
      date: r.date || today,
      change: undefined,
    }));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public sync helpers (unchanged interface used by existing code & tests)
// ---------------------------------------------------------------------------

export function getMarketPrices(): MarketPrice[] {
  return cachedPrices ?? HK_MARKET_PRICES;
}

export function searchMarketPrices(query: string): MarketPrice[] {
  const lowerQuery = query.toLowerCase();
  return getMarketPrices().filter(
    (item) =>
      item.itemName.toLowerCase().includes(lowerQuery) ||
      item.source.toLowerCase().includes(lowerQuery)
  );
}

export function getMarketPriceCategories(): string[] {
  return ['全部 All', '蔬菜 Vegetables', '水果 Fruits', '肉類 Meat', '海鮮 Seafood', '奶類 Dairy', '主食 Staples'];
}

export function filterByCategory(category: string): MarketPrice[] {
  if (category === '全部 All') return getMarketPrices();

  const categoryMap: Record<string, string[]> = {
    '蔬菜 Vegetables': ['菜心', '白菜', '番茄', '薯仔', '洋蔥', '西蘭花'],
    '水果 Fruits': ['蘋果', '橙', '香蕉', '提子'],
    '肉類 Meat': ['豬肉', '雞腿', '牛肉', '排骨'],
    '海鮮 Seafood': ['鯇魚', '蝦'],
    '奶類 Dairy': ['鮮奶', '雞蛋'],
    '主食 Staples': ['白米', '麵包'],
  };

  const keywords = categoryMap[category] ?? [];
  return getMarketPrices().filter((item) =>
    keywords.some((keyword) => item.itemName.includes(keyword))
  );
}

// ---------------------------------------------------------------------------
// Async refresh – called by the UI
// ---------------------------------------------------------------------------

/**
 * Attempt to refresh market prices from the live API.
 * Returns the (possibly updated) price list and whether live data was used.
 *
 * The function respects a 30-minute in-memory cache so rapid UI interactions
 * do not hammer the API.
 */
export async function refreshMarketPrices(): Promise<{ prices: MarketPrice[]; isLive: boolean }> {
  const now = Date.now();
  if (cachedPrices && now - cacheTimestamp < CACHE_TTL_MS) {
    return { prices: cachedPrices, isLive: cacheIsLive };
  }

  const live = await fetchLivePrices();
  if (live) {
    cachedPrices = live;
    cacheTimestamp = now;
    cacheIsLive = true;
    return { prices: live, isLive: true };
  }

  // Fall back to static data (do not cache as "live")
  cachedPrices = null;
  cacheIsLive = false;
  return { prices: HK_MARKET_PRICES, isLive: false };
}

/**
 * Generate simulated 7-day price history for a given item.
 * In production, this would fetch from a real API.
 * The data shown is simulated based on the current price and change values.
 */
export function getMarketPriceHistory(itemName: string): { date: string; price: number }[] {
  const item = getMarketPrices().find((p) => p.itemName === itemName);
  if (!item) return [];

  const today = new Date();
  const history: { date: string; price: number }[] = [];
  const dailyChange = item.change ?? 0;

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    // Simulate price history working backwards from today's price
    // Use a seeded variation based on item name hash and day offset for consistency
    let hash = 0;
    for (let j = 0; j < itemName.length; j++) {
      hash = ((hash << 5) - hash + itemName.charCodeAt(j)) | 0;
    }
    const seed = Math.abs(hash) + i * 7;
    const variation = (Math.sin(seed) * 0.5 + 0.5) * 2 - 1; // -1 to 1
    const historicalPrice = item.price - dailyChange * i + variation * Math.abs(dailyChange || 0.5);
    history.push({
      date: dateStr,
      price: Math.max(0.1, Number(historicalPrice.toFixed(1))),
    });
  }

  return history;
}

