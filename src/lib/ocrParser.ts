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
  /** Strategy number used for extraction (1=labeled, 2=slash, 3=numbers-only). Present only for debugging. */
  strategy?: number;
  /** Whether an Irregular Heartbeat (IHB) indicator was detected on the display. */
  irregularHeartbeat?: boolean;
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
 * Normalise raw OCR text to improve BP value extraction.
 *
 * LCD segment displays and mixed CJK/Latin text often produce:
 * - Stray pipe/bracket characters where digits should be (| → 1, O → 0)
 * - Full-width digits (０-９) instead of ASCII digits
 * - Extra whitespace, stray symbols, or control characters
 *
 * This function cleans the text *before* regex matching so that the
 * extraction patterns have a better chance of succeeding.
 */
export function normalizeBPText(raw: string): string {
  let t = raw;

  // Normalise line endings
  t = t.replace(/\r\n/g, '\n');

  // Full-width digits → ASCII digits  (offset 0xFEE0 = U+FF10 − U+0030)
  t = t.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));

  // Full-width colon / space → ASCII equivalents
  t = t.replace(/：/g, ':');
  t = t.replace(/\u3000/g, ' ');

  // Common OCR character misreads for digits (only when adjacent to digits or
  // at positions that look like part of a number sequence)
  // |, I, l (lowercase-L) → 1 when next to a digit
  // Note: $11 in replacement = capture-group $1 + literal '1' (JS spec §22.1.3.19)
  t = t.replace(/([0-9])[|Il](?=[0-9\s])/g, '$11');
  t = t.replace(/[|Il](?=[0-9])/g, '1');
  // O (uppercase letter) → 0 when between digits
  t = t.replace(/([0-9])O/g, '$10');
  t = t.replace(/O(?=[0-9])/g, '0');

  // Additional LCD segment display misreads:
  // } → 1 when adjacent to digits (LCD "1" can misread as brace)
  t = t.replace(/([0-9])[}](?=[0-9\s])/g, '$11');
  t = t.replace(/[}](?=[0-9])/g, '1');

  // Seven-segment display (SSD) character misreads.
  // LCD digit segments are often misinterpreted as letters by Tesseract.
  // Apply corrections only when adjacent to a digit to avoid corrupting labels.

  // b → 6 (SSD "6" resembles lowercase b)
  t = t.replace(/([0-9])b(?=[0-9\s])/g, '$16');
  t = t.replace(/b(?=[0-9])/g, '6');
  // Z/z → 2 (SSD "2" has angular shape like Z)
  t = t.replace(/([0-9])[Zz](?=[0-9\s])/g, '$12');
  t = t.replace(/[Zz](?=[0-9])/g, '2');
  // g → 9 (SSD "9" resembles lowercase g)
  t = t.replace(/([0-9])g(?=[0-9\s])/g, '$19');
  t = t.replace(/g(?=[0-9])/g, '9');
  // q → 9 (SSD "9" resembles lowercase q)
  t = t.replace(/([0-9])q(?=[0-9\s])/g, '$19');
  t = t.replace(/q(?=[0-9])/g, '9');
  // ! → 1 (SSD "1" can be misread as exclamation mark)
  t = t.replace(/([0-9])!(?=[0-9\s])/g, '$11');
  t = t.replace(/!(?=[0-9])/g, '1');
  // [ and ] → 1 (SSD "1" can be misread as bracket)
  t = t.replace(/([0-9])[\[\]](?=[0-9\s])/g, '$11');
  t = t.replace(/[\[\]](?=[0-9])/g, '1');

  // The following SSD substitutions apply only when the letter is sandwiched
  // between two digits, to avoid corrupting labels (SYS, BPM, DIA, etc.).
  // S/s → 5 (SSD "5" looks like S)
  t = t.replace(/([0-9])[Ss](?=[0-9])/g, '$15');
  // B → 8 (SSD "8" looks like B)
  t = t.replace(/([0-9])B(?=[0-9])/g, '$18');
  // D → 0 (SSD "0" looks like D)
  t = t.replace(/([0-9])D(?=[0-9])/g, '$10');

  // Remove periods/commas between consecutive digits — LCD segment artefacts;
  // BP values are always integers, never decimals.
  // Applied iteratively to handle chained cases like "1.1.4" → "114"
  {
    let prev;
    do {
      prev = t;
      t = t.replace(/(\d)[.,](\d)/g, '$1$2');
    } while (t !== prev);
  }

  // Remove stray non-meaningful characters that break digit sequences
  // (e.g. OCR inserting a dot, comma, or space between LCD segments)
  // Collapse multiple spaces
  t = t.replace(/[ \t]+/g, ' ');

  return t.trim();
}

/**
 * Detect whether an Irregular Heartbeat (IHB) indicator is present in
 * the OCR text.  Many BP monitors display "IHB", or a CJK equivalent
 * such as "不規則" (Traditional Chinese) / "不规则" (Simplified Chinese)
 * when an irregular pulse is detected during measurement.
 */
export function detectIrregularHeartbeat(text: string): boolean {
  const IHB_PATTERNS = [
    /\bIHB\b/i,
    /不規則/,   // Traditional Chinese
    /不规则/,   // Simplified Chinese
  ];
  return IHB_PATTERNS.some((re) => re.test(text));
}

/**
 * Remove date/time strings from text to prevent them from polluting
 * the number pool during BP value extraction (Strategy 3).
 *
 * BP monitors often display date/time (e.g. "2024/01/15", "12:30",
 * "2024-01-15").  The 4-digit year "2024" could yield false candidates
 * like "20" or "24"; time components "12:30" could inject "12" and "30".
 *
 * This function strips recognised date/time patterns before number
 * extraction so only BP-relevant values remain.
 */
export function stripDateTimePatterns(text: string): string {
  let t = text;
  // ISO-style dates: 2024/01/15, 2024-01-15, 2024.01.15
  t = t.replace(/\b\d{4}[/\-.](?:0?[1-9]|1[0-2])[/\-.](?:0?[1-9]|[12]\d|3[01])\b/g, ' ');
  // Reversed dates: 15/01/2024, 01-15-2024
  t = t.replace(/\b(?:0?[1-9]|[12]\d|3[01])[/\-.](?:0?[1-9]|1[0-2])[/\-.]\d{4}\b/g, ' ');
  // Time patterns: 12:30, 08:05, 23:59
  t = t.replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, ' ');
  // Standalone 4-digit year when preceded/followed by typical date context
  t = t.replace(/\b(19|20)\d{2}\b/g, ' ');
  return t;
}

/**
 * Parse OCR text from a blood pressure monitor display and extract
 * systolic, diastolic, and heart rate values.
 *
 * Handles common BP monitor display formats:
 * - Labeled (English): "SYS 120 DIA 80 PUL 72", "SYS. 135 DIA. 85 PUL. 68"
 * - Labeled (Chinese): "收縮壓 120 舒張壓 80 脈搏 72", "上壓 120 下壓 80 心跳 72"
 * - Slash format: "120/80", "120/80 72BPM"
 * - Numbers only: Three standalone numbers from a monitor display
 *
 * @param digitOnlyText — Optional text from a second Tesseract pass using a
 *   digit-only character whitelist (`tessedit_char_whitelist='0123456789'`).
 *   Seven-segment LCD digits are often misread as letters (e.g. 5→S, 6→b,
 *   8→B) by general-purpose OCR; the digit-only pass avoids these errors.
 *   When provided, this text is used for number extraction in Strategy 3.
 */
export function parseBPText(text: string, digitOnlyText?: string): ParsedBPData {
  const result: ParsedBPData = { systolic: '', diastolic: '', heartRate: '' };
  const normalized = normalizeBPText(text);
  if (!normalized) return result;

  // Detect Irregular Heartbeat indicator before parsing values
  if (detectIrregularHeartbeat(text) || detectIrregularHeartbeat(normalized)) {
    result.irregularHeartbeat = true;
  }

  // --- Strategy 1: Labeled patterns (most reliable) ---
  // Allow optional unit text (e.g. "mmHg") between labels and numbers
  // Supports both Traditional Chinese (收縮壓/舒張壓/脈搏) and Simplified Chinese (收缩压/舒张压/脉搏)
  // Also supports reversed order: "114 高压" (number before label)
  const SYS_LABEL = '(?:SYS(?:TOLIC)?|上壓|上压|收縮壓?|收缩压?|收縮|收缩|高压|高壓)';
  const DIA_LABEL = '(?:DIA(?:STOLIC)?|下壓|下压|舒張壓?|舒张压?|舒張|舒张|低压|低壓)';
  // 脉博/脈博 = common OCR misread of 脉搏/脈搏 (博 'extensive' vs 搏 'beat/pulse')
  const PUL_LABEL = '(?:PUL(?:SE)?|HR|HEART[ \\t]*RATE|PR|脈搏|脉搏|脉博|脈博|心跳|脈率|脉率|心率)';
  const BP_UNIT = '(?:mm[ \\t]*Hg|kPa)';
  const PUL_UNIT = '(?:\\/min|bpm|搏[ \\t]*[/／][ \\t]*分|次[ \\t]*[/／][ \\t]*分)';
  // Whitespace that does NOT cross newlines (avoids grabbing numbers from the next line)
  const SP = '[ \\t]';

  // Forward: label [unit] number  (same line only)
  const sysMatch = normalized.match(
    new RegExp(`${SYS_LABEL}[.:${SP}]*${BP_UNIT}?${SP}*(\\d{2,3})`, 'i'),
  );
  const diaMatch = normalized.match(
    new RegExp(`${DIA_LABEL}[.:${SP}]*${BP_UNIT}?${SP}*(\\d{2,3})`, 'i'),
  );
  const pulMatch = normalized.match(
    new RegExp(`${PUL_LABEL}[.:${SP}]*${PUL_UNIT}?${SP}*(\\d{2,3})`, 'i'),
  );

  // Reverse: number [unit] label  (some OCR engines output numbers before labels)
  const sysMatchRev = !sysMatch ? normalized.match(
    new RegExp(`(\\d{2,3})${SP}*${BP_UNIT}?${SP}*${SYS_LABEL}`, 'i'),
  ) : null;
  const diaMatchRev = !diaMatch ? normalized.match(
    new RegExp(`(\\d{2,3})${SP}*${BP_UNIT}?${SP}*${DIA_LABEL}`, 'i'),
  ) : null;
  const pulMatchRev = !pulMatch ? normalized.match(
    new RegExp(`(\\d{2,3})${SP}*${PUL_UNIT}?${SP}*${PUL_LABEL}`, 'i'),
  ) : null;

  if (sysMatch ?? sysMatchRev) result.systolic = (sysMatch ?? sysMatchRev)![1];
  if (diaMatch ?? diaMatchRev) result.diastolic = (diaMatch ?? diaMatchRev)![1];
  if (pulMatch ?? pulMatchRev) result.heartRate = (pulMatch ?? pulMatchRev)![1];

  if (result.systolic && result.diastolic) {
    if (!result.heartRate) {
      const bpmMatch = normalized.match(/(\d{2,3})\s*BPM/i);
      if (bpmMatch) result.heartRate = bpmMatch[1];
    }
    result.strategy = 1;
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
          new RegExp(`${PUL_LABEL}[.:${SP}]*${PUL_UNIT}?${SP}*(\\d{2,3})`, 'i'),
        );
        if (pulMatch2) result.heartRate = pulMatch2[1];
      }
      result.strategy = 2;
      return result;
    }
  }

  // --- Strategy 3: Number extraction (for BP monitor screens with just numbers) ---
  // Check for BPM-tagged heart rate first (always from the labelled text)
  const bpmMatch = normalized.match(/(\d{2,3})\s*BPM/i);
  if (bpmMatch) {
    result.heartRate = bpmMatch[1];
  }

  // When a digit-only OCR pass is available, use it for number extraction.
  // The digit-only pass is produced by Tesseract with
  // tessedit_char_whitelist='0123456789', which prevents seven-segment LCD
  // segments from being misinterpreted as letters (e.g. 5→S, 6→b, 8→B).
  const rawNumText = digitOnlyText ? normalizeBPText(digitOnlyText) : normalized;

  // Strip date/time patterns to prevent false matches (e.g. "2024" → "20", "24")
  const numText = stripDateTimePatterns(rawNumText);

  // Extract all 2-3 digit numbers in valid physiological ranges.
  // Use a non-digit boundary to avoid matching partial numbers
  // (e.g. avoids extracting '20' from '2024') without relying on lookbehind.
  const allNumbers: number[] = [];
  const numRegex = /(^|[^\d])(\d{2,3})(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = numRegex.exec(numText)) !== null) {
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

  // Try positional order first: BP monitors display systolic (row 1),
  // diastolic (row 2), heart rate (row 3) from top to bottom.
  // OCR preserves this top-to-bottom order in the extracted text.
  if (pool.length >= 2) {
    const first = pool[0];
    const second = pool[1];
    if (
      first >= 70 &&
      first <= 250 &&
      second >= 40 &&
      second <= 150 &&
      first > second
    ) {
      result.systolic = String(first);
      result.diastolic = String(second);
      if (
        !result.heartRate &&
        pool.length >= 3 &&
        pool[2] >= 30 &&
        pool[2] <= 200
      ) {
        result.heartRate = String(pool[2]);
      }
      result.strategy = 3;
      return result;
    }
  }

  // Fallback: sort by value when positional order doesn't produce valid results
  const unique = [...new Set(pool)];

  if (unique.length >= 2) {
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

  if (result.systolic || result.diastolic) {
    result.strategy = 3;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Word-level bounding-box helpers
// ---------------------------------------------------------------------------

/**
 * A Tesseract word with its bounding box and confidence score.
 * Mirrors the structure returned by `result.data.words`.
 */
export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * Parse BP values using Tesseract word-level bounding boxes.
 *
 * Instead of relying on text line order, this function groups words into
 * rows by Y-coordinate proximity, then assigns:
 *   - systolic = number in the row with the largest bounding-box height
 *     (typically the biggest font on the display)
 *   - diastolic = number in the next largest row
 *   - heart rate = number in the smallest row
 *
 * Falls back to `parseBPText()` when spatial parsing fails to find valid data.
 *
 * @param words — Array of word objects from `result.data.words`
 * @param fallbackText — Raw OCR text for fallback parsing
 * @param fallbackDigitOnlyText — Optional digit-only text for fallback
 */
export function parseBPFromWords(
  words: OcrWord[],
  fallbackText: string,
  fallbackDigitOnlyText?: string,
): ParsedBPData {
  // Filter to words that contain 2-3 digit numbers with reasonable confidence
  const MIN_WORD_CONFIDENCE = 40;
  const digitWords = words
    .filter((w) => w.confidence >= MIN_WORD_CONFIDENCE && /^\d{2,3}$/.test(w.text.trim()))
    .map((w) => ({
      value: parseInt(w.text.trim()),
      confidence: w.confidence,
      y: (w.bbox.y0 + w.bbox.y1) / 2,
      height: w.bbox.y1 - w.bbox.y0,
    }))
    .filter((w) => w.value >= 30 && w.value <= 250);

  if (digitWords.length < 2) {
    return parseBPText(fallbackText, fallbackDigitOnlyText);
  }

  // Group by Y-coordinate proximity (rows within 20% of average height)
  const avgHeight = digitWords.reduce((s, w) => s + w.height, 0) / digitWords.length;
  const yTolerance = avgHeight * 0.5;

  const rows: Array<typeof digitWords> = [];
  const sorted = [...digitWords].sort((a, b) => a.y - b.y);

  for (const word of sorted) {
    const existingRow = rows.find((row) =>
      Math.abs(row[0].y - word.y) < yTolerance,
    );
    if (existingRow) {
      existingRow.push(word);
    } else {
      rows.push([word]);
    }
  }

  if (rows.length < 2) {
    return parseBPText(fallbackText, fallbackDigitOnlyText);
  }

  // Sort rows by max bounding-box height (largest font first)
  const rowsWithSize = rows.map((row) => ({
    row,
    maxHeight: Math.max(...row.map((w) => w.height)),
    // Pick the highest-confidence number in each row
    bestWord: row.reduce((best, w) => (w.confidence > best.confidence ? w : best)),
  }));
  rowsWithSize.sort((a, b) => b.maxHeight - a.maxHeight);

  const result: ParsedBPData = { systolic: '', diastolic: '', heartRate: '' };

  // Check IHB in the full text
  const allText = words.map((w) => w.text).join(' ');
  if (detectIrregularHeartbeat(allText)) {
    result.irregularHeartbeat = true;
  }

  const sysCandidate = rowsWithSize[0]?.bestWord;
  const diaCandidate = rowsWithSize[1]?.bestWord;

  if (
    sysCandidate &&
    diaCandidate &&
    sysCandidate.value >= 70 &&
    sysCandidate.value <= 250 &&
    diaCandidate.value >= 40 &&
    diaCandidate.value <= 150 &&
    sysCandidate.value > diaCandidate.value
  ) {
    result.systolic = String(sysCandidate.value);
    result.diastolic = String(diaCandidate.value);

    if (rowsWithSize.length >= 3) {
      const hrCandidate = rowsWithSize[2].bestWord;
      if (hrCandidate.value >= 30 && hrCandidate.value <= 200) {
        result.heartRate = String(hrCandidate.value);
      }
    }
    result.strategy = 3;
    return result;
  }

  // Spatial parsing didn't produce valid results; fall back to text-based parsing
  return parseBPText(fallbackText, fallbackDigitOnlyText);
}
