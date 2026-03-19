import type { MarketPrice } from '@/types';

// Simulated market prices for common items in Hong Kong
// In production, this could be fetched from a real API or web scraping service
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

export function getMarketPrices(): MarketPrice[] {
  return HK_MARKET_PRICES;
}

export function searchMarketPrices(query: string): MarketPrice[] {
  const lowerQuery = query.toLowerCase();
  return HK_MARKET_PRICES.filter(
    (item) =>
      item.itemName.toLowerCase().includes(lowerQuery) ||
      item.source.toLowerCase().includes(lowerQuery)
  );
}

export function getMarketPriceCategories(): string[] {
  return ['全部 All', '蔬菜 Vegetables', '水果 Fruits', '肉類 Meat', '海鮮 Seafood', '奶類 Dairy', '主食 Staples'];
}

export function filterByCategory(category: string): MarketPrice[] {
  if (category === '全部 All') return HK_MARKET_PRICES;

  const categoryMap: Record<string, string[]> = {
    '蔬菜 Vegetables': ['菜心', '白菜', '番茄', '薯仔', '洋蔥', '西蘭花'],
    '水果 Fruits': ['蘋果', '橙', '香蕉', '提子'],
    '肉類 Meat': ['豬肉', '雞腿', '牛肉', '排骨'],
    '海鮮 Seafood': ['鯇魚', '蝦'],
    '奶類 Dairy': ['鮮奶', '雞蛋'],
    '主食 Staples': ['白米', '麵包'],
  };

  const keywords = categoryMap[category] ?? [];
  return HK_MARKET_PRICES.filter((item) =>
    keywords.some((keyword) => item.itemName.includes(keyword))
  );
}
