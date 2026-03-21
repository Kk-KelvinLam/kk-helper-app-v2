export interface PurchaseRecord {
  id: string;
  userId: string;
  itemName: string;
  price: number;
  category: string;
  location: string;
  notes: string;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
  ownerDisplayName?: string;
}

export interface PurchaseFormData {
  itemName: string;
  price: string;
  category: string;
  location: string;
  notes: string;
}

export interface MarketPrice {
  itemName: string;
  price: number;
  unit: string;
  source: string;
  date: string;
  change?: number;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface ShareRecord {
  id: string;
  ownerUserId: string;
  ownerDisplayName: string;
  ownerEmail: string;
  sharedWithUserId: string;
  sharedWithDisplayName: string;
  sharedWithEmail: string;
  createdAt: Date;
}

export const CATEGORIES = [
  '🥬 蔬菜 Vegetables',
  '🍎 水果 Fruits',
  '🥩 肉類 Meat',
  '🐟 海鮮 Seafood',
  '🥛 奶類 Dairy',
  '🍞 麵包 Bakery',
  '🥤 飲品 Beverages',
  '🧂 調味料 Condiments',
  '🍜 即食 Instant Food',
  '🧹 日用品 Household',
  '🧴 個人護理 Personal Care',
  '📦 其他 Others',
] as const;

export const LOCATIONS = [
  '百佳 PARKnSHOP',
  '惠康 Wellcome',
  'AEON',
  '一田 YATA',
  '大昌食品 DCH Food Mart',
  '街市 Wet Market',
  'HKTVmall',
  '日本城 JHC',
  '屈臣氏 Watsons',
  '萬寧 Mannings',
  'Costco',
  '其他 Others',
] as const;
