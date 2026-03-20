/**
 * OCR text parser for receipts and price tags.
 * Extracts structured data (item name, price, quantity, unit, location, category)
 * from raw OCR text produced by Tesseract.js on images of HK receipts / price tags.
 */

export interface ParsedReceiptData {
  itemName: string;
  price: string;
  location: string;
  category: string;
  notes: string;
}

export interface ParsedPriceTagData {
  name: string;
  price: string;
  quantity: string;
  unit: string;
}

// ---------------------------------------------------------------------------
// Price extraction
// ---------------------------------------------------------------------------

/**
 * Extract the first price amount from OCR text.
 * Handles patterns like: $12.50, HK$12.50, 12.50元, 12.50港元
 */
export function extractPrice(text: string): string {
  const patterns = [
    /HK\$\s*(\d+\.?\d*)/i,
    /\$\s*(\d+\.?\d*)/,
    /(\d+\.?\d*)\s*港元/,
    /(\d+\.?\d*)\s*元/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && parseFloat(match[1]) > 0) {
      return match[1];
    }
  }

  // Fallback: first standalone decimal number that looks like a price
  const standalone = text.match(/\b(\d{1,4}\.\d{1,2})\b/);
  if (standalone && parseFloat(standalone[1]) > 0) {
    return standalone[1];
  }

  return '';
}

// ---------------------------------------------------------------------------
// Quantity + unit extraction
// ---------------------------------------------------------------------------

/**
 * Unit detection patterns ordered from most specific to least specific.
 * Returns { quantity, unit } where unit matches SUPPORTED_UNITS values.
 */
export function extractQuantityUnit(text: string): { quantity: string; unit: string } {
  const unitPatterns: Array<{ pattern: RegExp; unit: string }> = [
    { pattern: /(\d+\.?\d*)\s*(?:kg|公斤|千克)/i, unit: 'kg' },
    { pattern: /(\d+\.?\d*)\s*(?:ml|毫升)/i, unit: 'mL' },
    // Negative lookahead (?!b) prevents matching the 'L' in 'lb' (which has its own pattern below)
    { pattern: /(\d+\.?\d*)\s*(?:L|公升|升)(?!b)/i, unit: 'L' },
    { pattern: /(\d+\.?\d*)\s*(?:lb|磅)/i, unit: 'lb' },
    { pattern: /(\d+\.?\d*)\s*(?:oz|安士)/i, unit: 'oz' },
    // catty and tael must come before generic g to avoid false matches
    { pattern: /(\d+\.?\d*)\s*斤/, unit: 'catty' },
    { pattern: /(\d+\.?\d*)\s*兩/, unit: 'tael' },
    { pattern: /(\d+\.?\d*)\s*(?:g|克|公克)(?!\s*(?:kg|公斤))/i, unit: 'g' },
    { pattern: /(\d+\.?\d*)\s*(?:件|pcs?|pieces?)/i, unit: 'piece' },
    { pattern: /(\d+\.?\d*)\s*(?:包|packs?)/i, unit: 'pack' },
  ];

  for (const { pattern, unit } of unitPatterns) {
    const match = text.match(pattern);
    if (match && parseFloat(match[1]) > 0) {
      return { quantity: match[1], unit };
    }
  }

  return { quantity: '', unit: 'g' };
}

// ---------------------------------------------------------------------------
// Location detection
// ---------------------------------------------------------------------------

const LOCATION_KEYWORDS: Array<{ keywords: string[]; location: string }> = [
  { keywords: ['百佳', 'PARKnSHOP', 'PARKNSHOP'], location: '百佳 PARKnSHOP' },
  { keywords: ['惠康', 'Wellcome', 'WELLCOME'], location: '惠康 Wellcome' },
  { keywords: ['AEON', 'aeon'], location: 'AEON' },
  { keywords: ['一田', 'YATA', 'yata'], location: '一田 YATA' },
  { keywords: ['大昌', 'DCH Food', 'DCH'], location: '大昌食品 DCH Food Mart' },
  { keywords: ['HKTVmall', 'HKTVMALL', 'hktvmall'], location: 'HKTVmall' },
  { keywords: ['日本城', 'JHC'], location: '日本城 JHC' },
  { keywords: ['屈臣氏', 'Watsons', 'WATSONS'], location: '屈臣氏 Watsons' },
  { keywords: ['萬寧', 'Mannings', 'MANNINGS'], location: '萬寧 Mannings' },
  { keywords: ['Costco', 'COSTCO'], location: 'Costco' },
  { keywords: ['街市', '街坊', '菜欄'], location: '街市 Wet Market' },
];

/**
 * Match text against known HK store/market names and return the matched location value.
 */
export function detectLocation(text: string): string {
  for (const { keywords, location } of LOCATION_KEYWORDS) {
    for (const kw of keywords) {
      if (text.toLowerCase().includes(kw.toLowerCase())) {
        return location;
      }
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Category detection
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: string }> = [
  {
    keywords: ['菜', '蔬菜', '青菜', '白菜', '菜心', '西蘭花', '番茄', '洋蔥', '薯仔', '馬鈴薯', 'potato', 'vegetable', 'veg', 'broccoli', 'tomato', 'onion'],
    category: '🥬 蔬菜 Vegetables',
  },
  {
    keywords: ['水果', '生果', '蘋果', '橙', '香蕉', '提子', '葡提子', 'apple', 'orange', 'banana', 'grape', 'fruit'],
    category: '🍎 水果 Fruits',
  },
  {
    keywords: ['豬肉', '牛肉', '雞肉', '羊肉', '鴨肉', '排骨', '雞腿', '豬扒', 'pork', 'beef', 'chicken', 'lamb', 'meat'],
    category: '🥩 肉類 Meat',
  },
  {
    keywords: ['魚', '蝦', '蟹', '海鮮', '鮮魚', '三文魚', '金鯧', 'fish', 'shrimp', 'prawn', 'crab', 'seafood', 'salmon'],
    category: '🐟 海鮮 Seafood',
  },
  {
    keywords: ['牛奶', '鮮奶', '芝士', '乳酪', '忌廉', '雞蛋', 'milk', 'cheese', 'dairy', 'yogurt', 'egg', 'cream'],
    category: '🥛 奶類 Dairy',
  },
  {
    keywords: ['麵包', '多士', '吐司', '蛋糕', '餅乾', 'bread', 'toast', 'cake', 'biscuit', 'bakery'],
    category: '🍞 麵包 Bakery',
  },
  {
    keywords: ['飲料', '飲品', '汽水', '可樂', '咖啡', '茶', '果汁', '礦泉水', 'drink', 'beverage', 'coffee', 'tea', 'juice', 'water', 'cola'],
    category: '🥤 飲品 Beverages',
  },
  {
    keywords: ['醬油', '生抽', '老抽', '蠔油', '食油', '鹽', '糖', '醋', '調味', 'sauce', 'soy', 'oil', 'salt', 'sugar', 'vinegar', 'seasoning'],
    category: '🧂 調味料 Condiments',
  },
  {
    keywords: ['即食', '罐頭', '泡麵', '方便麵', 'instant', 'noodle', 'canned'],
    category: '🍜 即食 Instant Food',
  },
  {
    keywords: ['清潔', '洗衣', '廁紙', '廚紙', '垃圾', 'clean', 'detergent', 'tissue', 'toilet', 'household'],
    category: '🧹 日用品 Household',
  },
  {
    keywords: ['護膚', '洗頭水', '沐浴', '牙膏', '牙刷', '化妝', 'shampoo', 'skincare', 'toothpaste', 'personal'],
    category: '🧴 個人護理 Personal Care',
  },
];

/**
 * Guess the CATEGORIES value most relevant to the OCR text.
 */
export function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return category;
      }
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Item-name extraction
// ---------------------------------------------------------------------------

/** Maximum character length returned for an extracted item name. */
const MAX_ITEM_NAME_LENGTH = 60;

/** Regex fragments used to strip non-name content from lines */
const PRICE_RE = /(?:HK)?\$\s*\d+\.?\d*|\d+\.?\d*\s*(?:港元|元)/gi;
const QTY_UNIT_RE =
  /\d+\.?\d*\s*(?:kg|公斤|千克|ml|毫升|L|公升|升|lb|磅|oz|安士|g|克|公克|斤|兩|件|pcs?|pieces?|包|packs?)/gi;
const STORE_RE =
  /百佳|PARKnSHOP|惠康|Wellcome|AEON|一田|YATA|大昌|DCH|HKTVmall|HKTV|日本城|JHC|屈臣氏|Watsons|萬寧|Mannings|Costco|街市/gi;
const RECEIPT_WORDS_RE =
  /合計|小計|總計|Total|SubTotal|Tax|稅|收據|Receipt|Change|找續|找零|收銀/gi;

/**
 * Extract the most likely product-name line from OCR text.
 * Strips price, quantity/unit, store name, and receipt boilerplate,
 * then returns the first non-empty, non-numeric line.
 */
export function extractItemName(text: string): string {
  const lines = text.split(/[\n\r]+/).map((l) =>
    l
      .replace(PRICE_RE, '')
      .replace(QTY_UNIT_RE, '')
      .replace(STORE_RE, '')
      .replace(RECEIPT_WORDS_RE, '')
      .replace(/\s+/g, ' ')
      .trim()
  );

  for (const line of lines) {
    // Skip purely numeric lines, very short lines, or empty lines
    if (line.length < 2 || /^\d+\.?\d*$/.test(line)) continue;
    return line.substring(0, MAX_ITEM_NAME_LENGTH);
  }

  return '';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse OCR text from a receipt or supermarket label and return
 * structured data suitable for filling a purchase-record form.
 */
export function parseReceiptText(text: string): ParsedReceiptData {
  return {
    itemName: extractItemName(text),
    price: extractPrice(text),
    location: detectLocation(text),
    category: detectCategory(text),
    notes: text.trim(),
  };
}

/**
 * Parse OCR text from a price tag and return structured data
 * suitable for filling a unit-price-calculator item.
 */
export function parsePriceTagText(text: string): ParsedPriceTagData {
  const { quantity, unit } = extractQuantityUnit(text);
  return {
    name: extractItemName(text),
    price: extractPrice(text),
    quantity,
    unit,
  };
}
