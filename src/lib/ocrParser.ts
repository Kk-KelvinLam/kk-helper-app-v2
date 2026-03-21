/**
 * OCR text parser for receipts, price tags, and blood pressure monitors.
 * Extracts structured data from raw OCR text produced by Tesseract.js.
 */

/**
 * Parsed blood pressure data extracted from OCR text.
 * Fields are numeric strings (e.g. '120') or empty strings when not detected.
 */
export interface ParsedBPData {
  systolic: string;
  diastolic: string;
  heartRate: string;
}

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

// ---------------------------------------------------------------------------
// Blood pressure text parsing
// ---------------------------------------------------------------------------

/**
 * Parse OCR text from a blood pressure monitor display and extract
 * systolic, diastolic, and heart rate values.
 *
 * Handles common BP monitor display formats:
 * - Labeled (English): "SYS 120 DIA 80 PUL 72", "SYS. 135 DIA. 85 PUL. 68"
 * - Labeled (Chinese): "收縮壓 120 舒張壓 80 脈搏 72", "上壓 120 下壓 80 心跳 72"
 * - Slash format: "120/80", "120/80 72BPM"
 * - Numbers only: Three standalone numbers from a monitor display
 */
export function parseBPText(text: string): ParsedBPData {
  const result: ParsedBPData = { systolic: '', diastolic: '', heartRate: '' };
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return result;

  // --- Strategy 1: Labeled patterns (most reliable) ---
  const sysMatch = normalized.match(
    /(?:SYS(?:TOLIC)?|上壓|收縮壓?|收縮)[.:\s]*(\d{2,3})/i,
  );
  const diaMatch = normalized.match(
    /(?:DIA(?:STOLIC)?|下壓|舒張壓?|舒張)[.:\s]*(\d{2,3})/i,
  );
  const pulMatch = normalized.match(
    /(?:PUL(?:SE)?|HR|HEART\s*RATE|PR|脈搏|心跳|脈率)[.:\s]*(\d{2,3})/i,
  );

  if (sysMatch) result.systolic = sysMatch[1];
  if (diaMatch) result.diastolic = diaMatch[1];
  if (pulMatch) result.heartRate = pulMatch[1];

  if (result.systolic && result.diastolic) {
    if (!result.heartRate) {
      const bpmMatch = normalized.match(/(\d{2,3})\s*BPM/i);
      if (bpmMatch) result.heartRate = bpmMatch[1];
    }
    return result;
  }

  // --- Strategy 2: Slash format "120/80" ---
  const slashMatch = normalized.match(/(\d{2,3})\s*[/／]\s*(\d{2,3})/);
  if (slashMatch) {
    const sys = parseInt(slashMatch[1]);
    const dia = parseInt(slashMatch[2]);
    if (sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150 && sys > dia) {
      result.systolic = slashMatch[1];
      result.diastolic = slashMatch[2];

      if (!result.heartRate) {
        const bpmMatch = normalized.match(/(\d{2,3})\s*BPM/i);
        if (
          bpmMatch &&
          bpmMatch[1] !== result.systolic &&
          bpmMatch[1] !== result.diastolic
        ) {
          result.heartRate = bpmMatch[1];
        }
      }
      if (!result.heartRate) {
        const pulMatch2 = normalized.match(
          /(?:PUL(?:SE)?|HR|PR|脈搏|心跳|脈率)[.:\s]*(\d{2,3})/i,
        );
        if (pulMatch2) result.heartRate = pulMatch2[1];
      }
      return result;
    }
  }

  // --- Strategy 3: Number extraction (for BP monitor screens with just numbers) ---
  // Check for BPM-tagged heart rate first
  const bpmMatch = normalized.match(/(\d{2,3})\s*BPM/i);
  if (bpmMatch) {
    result.heartRate = bpmMatch[1];
  }

  // Extract all 2-3 digit numbers in valid physiological ranges.
  // Use a non-digit boundary to avoid matching partial numbers
  // (e.g. avoids extracting '20' from '2024') without relying on lookbehind.
  const allNumbers: number[] = [];
  const numRegex = /(^|[^\d])(\d{2,3})(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = numRegex.exec(normalized)) !== null) {
    const n = parseInt(m[2]);
    if (n >= 30 && n <= 250) {
      allNumbers.push(n);
    }
  }

  // Remove heart rate value from pool if already identified via BPM label
  const pool = [...allNumbers];
  if (result.heartRate) {
    const hrVal = parseInt(result.heartRate);
    const idx = pool.indexOf(hrVal);
    if (idx >= 0) pool.splice(idx, 1);
  }

  const unique = [...new Set(pool)];

  if (unique.length >= 2) {
    // Sort descending: systolic is typically the highest number
    const sorted = [...unique].sort((a, b) => b - a);
    if (
      sorted[0] >= 70 &&
      sorted[0] <= 250 &&
      sorted[1] >= 40 &&
      sorted[1] <= 150 &&
      sorted[0] > sorted[1]
    ) {
      result.systolic = String(sorted[0]);
      result.diastolic = String(sorted[1]);
      if (
        !result.heartRate &&
        sorted.length >= 3 &&
        sorted[2] >= 30 &&
        sorted[2] <= 200
      ) {
        result.heartRate = String(sorted[2]);
      }
    }
  }

  return result;
}
