import { describe, it, expect } from 'vitest';
import {
  extractPrice,
  extractQuantityUnit,
  detectLocation,
  detectCategory,
  extractItemName,
  parseReceiptText,
  parsePriceTagText,
  parseBPText,
  normalizeBPText,
  detectIrregularHeartbeat,
  stripDateTimePatterns,
  parseBPFromWords,
  type OcrWord,
} from '@/lib/ocrParser';

describe('ocrParser', () => {
  // -------------------------------------------------------------------------
  describe('extractPrice', () => {
    it('extracts HK dollar sign price', () => {
      expect(extractPrice('牛奶 $22.50')).toBe('22.50');
    });

    it('extracts HK$ prefix price', () => {
      expect(extractPrice('HK$28.90')).toBe('28.90');
    });

    it('extracts 元 suffix price', () => {
      expect(extractPrice('價格：15.00元')).toBe('15.00');
    });

    it('extracts 港元 suffix price', () => {
      expect(extractPrice('35.00港元')).toBe('35.00');
    });

    it('extracts a standalone decimal as fallback', () => {
      expect(extractPrice('豬肉 48.00')).toBe('48.00');
    });

    it('returns empty string when no price found', () => {
      expect(extractPrice('no price here')).toBe('');
    });

    it('ignores zero amounts', () => {
      expect(extractPrice('$0.00')).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  describe('extractQuantityUnit', () => {
    it('detects grams', () => {
      expect(extractQuantityUnit('500g裝')).toEqual({ quantity: '500', unit: 'g' });
    });

    it('detects kg', () => {
      expect(extractQuantityUnit('1kg袋')).toEqual({ quantity: '1', unit: 'kg' });
    });

    it('detects catty (斤)', () => {
      expect(extractQuantityUnit('2斤裝')).toEqual({ quantity: '2', unit: 'catty' });
    });

    it('detects tael (兩)', () => {
      expect(extractQuantityUnit('4兩豬肉')).toEqual({ quantity: '4', unit: 'tael' });
    });

    it('detects litres', () => {
      expect(extractQuantityUnit('鮮奶1L')).toEqual({ quantity: '1', unit: 'L' });
    });

    it('detects millilitres', () => {
      expect(extractQuantityUnit('500ml')).toEqual({ quantity: '500', unit: 'mL' });
    });

    it('detects pounds (lb)', () => {
      expect(extractQuantityUnit('1.5lb')).toEqual({ quantity: '1.5', unit: 'lb' });
    });

    it('detects ounces (oz)', () => {
      expect(extractQuantityUnit('8oz')).toEqual({ quantity: '8', unit: 'oz' });
    });

    it('detects pieces', () => {
      expect(extractQuantityUnit('10件裝')).toEqual({ quantity: '10', unit: 'piece' });
    });

    it('detects packs', () => {
      expect(extractQuantityUnit('3包')).toEqual({ quantity: '3', unit: 'pack' });
    });

    it('returns empty string and default g when no unit found', () => {
      expect(extractQuantityUnit('no unit here')).toEqual({ quantity: '', unit: 'g' });
    });

    it('prefers kg over g when both patterns could match', () => {
      expect(extractQuantityUnit('1kg')).toEqual({ quantity: '1', unit: 'kg' });
    });
  });

  // -------------------------------------------------------------------------
  describe('detectLocation', () => {
    it('detects 百佳', () => {
      expect(detectLocation('百佳超市收據')).toBe('百佳 PARKnSHOP');
    });

    it('detects PARKnSHOP (English)', () => {
      expect(detectLocation('PARKnSHOP Supermarket')).toBe('百佳 PARKnSHOP');
    });

    it('detects 惠康', () => {
      expect(detectLocation('惠康 Wellcome')).toBe('惠康 Wellcome');
    });

    it('detects AEON', () => {
      expect(detectLocation('AEON Store')).toBe('AEON');
    });

    it('detects 街市', () => {
      expect(detectLocation('街市攤位')).toBe('街市 Wet Market');
    });

    it('detects Watsons', () => {
      expect(detectLocation('Watsons receipt')).toBe('屈臣氏 Watsons');
    });

    it('returns empty string when no store matched', () => {
      expect(detectLocation('some random text')).toBe('');
    });

    it('is case-insensitive for English keywords', () => {
      expect(detectLocation('wellcome supermarket')).toBe('惠康 Wellcome');
    });
  });

  // -------------------------------------------------------------------------
  describe('detectCategory', () => {
    it('detects vegetables', () => {
      expect(detectCategory('菜心 $12')).toBe('🥬 蔬菜 Vegetables');
    });

    it('detects fruits', () => {
      expect(detectCategory('蘋果 $25')).toBe('🍎 水果 Fruits');
    });

    it('detects meat', () => {
      expect(detectCategory('豬肉 $48')).toBe('🥩 肉類 Meat');
    });

    it('detects seafood', () => {
      expect(detectCategory('大蝦 $65')).toBe('🐟 海鮮 Seafood');
    });

    it('detects dairy', () => {
      expect(detectCategory('鮮奶 1L $22')).toBe('🥛 奶類 Dairy');
    });

    it('detects beverages', () => {
      expect(detectCategory('可樂 $8')).toBe('🥤 飲品 Beverages');
    });

    it('returns empty string when no category matched', () => {
      expect(detectCategory('xyz random item')).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  describe('extractItemName', () => {
    it('returns item name with price removed', () => {
      const name = extractItemName('鮮奶 $22.50');
      expect(name).toBe('鮮奶');
    });

    it('returns item name with quantity/unit removed', () => {
      const name = extractItemName('有機豆奶 1L $15.90');
      expect(name).toBeTruthy();
      expect(name).not.toContain('1L');
      expect(name).not.toContain('15.90');
    });

    it('strips store names', () => {
      const name = extractItemName('百佳\n雞蛋 10隻\n$25.00');
      expect(name).not.toContain('百佳');
    });

    it('skips purely numeric lines', () => {
      // A line that is only a number should be skipped
      const name = extractItemName('12345\n牛肉 $80');
      expect(name).toBe('牛肉');
    });

    it('returns empty string for text with no meaningful name', () => {
      const name = extractItemName('$25.00\n500g\n$0.05/g');
      // Should return empty or a non-empty cleaned string – must not crash
      expect(typeof name).toBe('string');
    });
  });

  // -------------------------------------------------------------------------
  describe('parseReceiptText', () => {
    it('parses a typical HK supermarket receipt line', () => {
      const result = parseReceiptText('百佳\n鮮奶 1L\n$22.50');
      expect(result.price).toBe('22.50');
      expect(result.location).toBe('百佳 PARKnSHOP');
      expect(result.category).toBe('🥛 奶類 Dairy');
      expect(result.notes).toContain('鮮奶');
    });

    it('parses a wet market price tag', () => {
      const result = parseReceiptText('街市\n豬肉(瘦)\n$48.00/斤');
      expect(result.price).toBe('48.00');
      expect(result.location).toBe('街市 Wet Market');
      expect(result.category).toBe('🥩 肉類 Meat');
    });

    it('always returns notes equal to trimmed input', () => {
      const input = '  some text  ';
      const result = parseReceiptText(input);
      expect(result.notes).toBe(input.trim());
    });
  });

  // -------------------------------------------------------------------------
  describe('parsePriceTagText', () => {
    it('parses price tag with price and weight', () => {
      const result = parsePriceTagText('有機豆奶\n1L\n$15.90');
      expect(result.price).toBe('15.90');
      expect(result.quantity).toBe('1');
      expect(result.unit).toBe('L');
    });

    it('parses gram-based price tag', () => {
      const result = parsePriceTagText('薯片 150g $19.90');
      expect(result.price).toBe('19.90');
      expect(result.quantity).toBe('150');
      expect(result.unit).toBe('g');
    });

    it('parses catty price tag', () => {
      const result = parsePriceTagText('牛肉\n1斤\n$80');
      expect(result.price).toBe('80');
      expect(result.quantity).toBe('1');
      expect(result.unit).toBe('catty');
    });

    it('returns empty name/price/quantity when none found', () => {
      const result = parsePriceTagText('');
      expect(result.name).toBe('');
      expect(result.price).toBe('');
      expect(result.quantity).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  describe('parseBPText', () => {
    it('extracts from SYS/DIA/PUL labels', () => {
      const result = parseBPText('SYS 120 DIA 80 PUL 72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts from SYS./DIA./PUL. labels with dots', () => {
      const result = parseBPText('SYS. 135\nDIA. 85\nPUL. 68');
      expect(result).toEqual(expect.objectContaining({
        systolic: '135', diastolic: '85', heartRate: '68',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts from SYSTOLIC/DIASTOLIC labels', () => {
      const result = parseBPText('Systolic: 118\nDiastolic: 78\nPulse: 65');
      expect(result).toEqual(expect.objectContaining({
        systolic: '118', diastolic: '78', heartRate: '65',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts from HR label', () => {
      const result = parseBPText('SYS 120 DIA 80 HR 72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts with BPM suffix when labels present', () => {
      const result = parseBPText('SYS 120 DIA 80 72BPM');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts from slash format "120/80"', () => {
      const result = parseBPText('120/80');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '',
      }));
      expect(result.strategy).toBe(2);
    });

    it('extracts from slash format with spaces', () => {
      const result = parseBPText('120 / 80');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '',
      }));
      expect(result.strategy).toBe(2);
    });

    it('extracts from slash format with BPM', () => {
      const result = parseBPText('120/80 72BPM');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(2);
    });

    it('extracts from slash format with full-width slash', () => {
      const result = parseBPText('135／88');
      expect(result).toEqual(expect.objectContaining({
        systolic: '135', diastolic: '88', heartRate: '',
      }));
      expect(result.strategy).toBe(2);
    });

    it('extracts Chinese labels (收縮壓/舒張壓/脈搏)', () => {
      const result = parseBPText('收縮壓 120 舒張壓 80 脈搏 72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts Chinese casual labels (上壓/下壓/心跳)', () => {
      const result = parseBPText('上壓 120\n下壓 80\n心跳 72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts Simplified Chinese labels (收缩压/舒张压/脉搏)', () => {
      const result = parseBPText('收缩压 120 舒张压 80 脉搏 72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts Simplified Chinese casual labels (上压/下压/心率)', () => {
      const result = parseBPText('上压 120\n下压 80\n心率 72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts Simplified Chinese labels (高压/低压)', () => {
      const result = parseBPText('高压 130\n低压 85\n脉搏 68');
      expect(result).toEqual(expect.objectContaining({
        systolic: '130', diastolic: '85', heartRate: '68',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts Cofoe KF-65B style (高压/低压/脉搏 with units)', () => {
      const result = parseBPText('高压 114 kPa\n低压 67 mmHg\n脉搏 83 搏/分');
      expect(result).toEqual(expect.objectContaining({
        systolic: '114', diastolic: '67', heartRate: '83',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts when unit 搏/分 appears between label and number', () => {
      const result = parseBPText('高压 kPa 114\n低压 mmHg 67\n脉搏 搏/分 83');
      expect(result).toEqual(expect.objectContaining({
        systolic: '114', diastolic: '67', heartRate: '83',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts with OCR misread 脉博 (博 instead of 搏)', () => {
      const result = parseBPText('高压 130\n低压 85\n脉博 68');
      expect(result).toEqual(expect.objectContaining({
        systolic: '130', diastolic: '85', heartRate: '68',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts with 次/分 pulse unit', () => {
      const result = parseBPText('高压 120\n低压 80\n心率 次/分 72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts from three standalone numbers', () => {
      const result = parseBPText('120\n80\n72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(3);
    });

    it('extracts from three numbers in any order', () => {
      const result = parseBPText('72\n120\n80');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(3);
    });

    it('extracts with mmHg and BPM suffixes', () => {
      const result = parseBPText('120 mmHg\n80 mmHg\n72 BPM');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
    });

    it('extracts systolic and diastolic only when two numbers found', () => {
      const result = parseBPText('130\n85');
      expect(result).toEqual(expect.objectContaining({
        systolic: '130', diastolic: '85', heartRate: '',
      }));
      expect(result.strategy).toBe(3);
    });

    it('returns empty strings when no BP data found', () => {
      expect(parseBPText('no numbers here')).toEqual(expect.objectContaining({
        systolic: '', diastolic: '', heartRate: '',
      }));
    });

    it('returns empty strings for empty input', () => {
      expect(parseBPText('')).toEqual(expect.objectContaining({
        systolic: '', diastolic: '', heartRate: '',
      }));
    });

    it('ignores date-like patterns (e.g. 2024/01/15)', () => {
      const result = parseBPText('2024/01/15\n120\n80\n72');
      expect(result.systolic).toBe('120');
      expect(result.diastolic).toBe('80');
    });

    it('handles high blood pressure readings', () => {
      const result = parseBPText('SYS 180 DIA 110 PUL 95');
      expect(result).toEqual(expect.objectContaining({
        systolic: '180', diastolic: '110', heartRate: '95',
      }));
      expect(result.strategy).toBe(1);
    });

    it('handles PR label for pulse rate', () => {
      const result = parseBPText('SYS 125\nDIA 82\nPR 70');
      expect(result).toEqual(expect.objectContaining({
        systolic: '125', diastolic: '82', heartRate: '70',
      }));
      expect(result.strategy).toBe(1);
    });

    it('uses positional order when heart rate > diastolic', () => {
      const result = parseBPText('130\n70\n85');
      expect(result).toEqual(expect.objectContaining({
        systolic: '130', diastolic: '70', heartRate: '85',
      }));
      expect(result.strategy).toBe(3);
    });

    it('uses positional order for typical BP monitor (sys > hr > dia)', () => {
      const result = parseBPText('115\n72\n78');
      expect(result).toEqual(expect.objectContaining({
        systolic: '115', diastolic: '72', heartRate: '78',
      }));
      expect(result.strategy).toBe(3);
    });

    it('extracts labels with mmHg unit between label and number', () => {
      const result = parseBPText('SYS mmHg 120\nDIA mmHg 80\nPUL /min 72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts labels with kPa unit between label and number', () => {
      const result = parseBPText('SYS kPa 120\nDIA kPa 80\nPUL 72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });

    it('handles duplicate diastolic and heart rate values via positional order', () => {
      const result = parseBPText('120\n80\n80');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '80',
      }));
      expect(result.strategy).toBe(3);
    });

    // --- New tests for text normalisation ---

    it('handles full-width digits (０-９)', () => {
      const result = parseBPText('SYS １２０ DIA ８０ PUL ７２');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });

    it('handles pipe character misread as digit 1 (e.g. |14 → 114)', () => {
      const result = parseBPText('高压 |14\n低压 67\n脉搏 83');
      expect(result).toEqual(expect.objectContaining({
        systolic: '114', diastolic: '67', heartRate: '83',
      }));
      expect(result.strategy).toBe(1);
    });

    it('handles O misread as 0 in numbers (e.g. 12O → 120)', () => {
      const result = parseBPText('SYS 12O DIA 8O PUL 72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });

    it('handles reversed label order: number before label (114 高压)', () => {
      const result = parseBPText('114 高压\n67 低压\n83 脉搏');
      expect(result).toEqual(expect.objectContaining({
        systolic: '114', diastolic: '67', heartRate: '83',
      }));
      expect(result.strategy).toBe(1);
    });

    it('handles reversed label order with units (114 kPa 高压)', () => {
      const result = parseBPText('114 kPa 高压\n67 mmHg 低压\n83 脉搏');
      expect(result).toEqual(expect.objectContaining({
        systolic: '114', diastolic: '67', heartRate: '83',
      }));
      expect(result.strategy).toBe(1);
    });

    it('extracts Traditional Chinese 高壓/低壓 labels', () => {
      const result = parseBPText('高壓 120\n低壓 80\n脈搏 72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });

    it('handles Traditional Chinese OCR misread 脈博', () => {
      const result = parseBPText('高壓 130\n低壓 85\n脈博 68');
      expect(result).toEqual(expect.objectContaining({
        systolic: '130', diastolic: '85', heartRate: '68',
      }));
      expect(result.strategy).toBe(1);
    });

    it('handles full-width colon in labels', () => {
      const result = parseBPText('SYS：120\nDIA：80\nPUL：72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('normalizeBPText', () => {
    it('converts full-width digits to ASCII', () => {
      expect(normalizeBPText('１２０')).toBe('120');
    });

    it('converts full-width colon to ASCII', () => {
      expect(normalizeBPText('SYS：120')).toBe('SYS:120');
    });

    it('converts ideographic space to ASCII space', () => {
      expect(normalizeBPText('SYS\u3000120')).toBe('SYS 120');
    });

    it('normalises pipe next to digit to 1', () => {
      expect(normalizeBPText('|14')).toBe('114');
    });

    it('normalises uppercase O between digits to 0', () => {
      expect(normalizeBPText('12O')).toBe('120');
    });

    it('collapses multiple spaces', () => {
      expect(normalizeBPText('SYS   120')).toBe('SYS 120');
    });

    it('trims whitespace', () => {
      expect(normalizeBPText('  120 80 72  ')).toBe('120 80 72');
    });

    it('normalises CRLF to LF', () => {
      expect(normalizeBPText('120\r\n80')).toBe('120\n80');
    });

    it('normalises } adjacent to digits to 1', () => {
      expect(normalizeBPText('}14')).toBe('114');
      expect(normalizeBPText('1}4')).toBe('114');
    });

    it('removes periods between consecutive digits (LCD artefact)', () => {
      expect(normalizeBPText('1.1.4')).toBe('114');
      expect(normalizeBPText('6.7')).toBe('67');
    });

    it('removes commas between consecutive digits (LCD artefact)', () => {
      expect(normalizeBPText('1,14')).toBe('114');
    });

    // --- Seven-segment display (SSD) character misread corrections ---

    it('normalises b adjacent to digits to 6 (SSD misread)', () => {
      expect(normalizeBPText('b7')).toBe('67');
      expect(normalizeBPText('1b4')).toBe('164');
    });

    it('normalises Z/z adjacent to digits to 2 (SSD misread)', () => {
      expect(normalizeBPText('1Z0')).toBe('120');
      expect(normalizeBPText('z5')).toBe('25');
    });

    it('normalises g adjacent to digits to 9 (SSD misread)', () => {
      expect(normalizeBPText('g3')).toBe('93');
      expect(normalizeBPText('1g0')).toBe('190');
    });

    it('normalises q adjacent to digits to 9 (SSD misread)', () => {
      expect(normalizeBPText('q2')).toBe('92');
      expect(normalizeBPText('1q5')).toBe('195');
    });

    it('normalises ! adjacent to digits to 1 (SSD misread)', () => {
      expect(normalizeBPText('!14')).toBe('114');
      expect(normalizeBPText('1!4')).toBe('114');
    });

    it('normalises [ and ] adjacent to digits to 1 (SSD misread)', () => {
      expect(normalizeBPText('[14')).toBe('114');
      expect(normalizeBPText('1]4')).toBe('114');
    });

    it('normalises S between digits to 5 (SSD misread)', () => {
      expect(normalizeBPText('1S4')).toBe('154');
    });

    it('does NOT convert S in labels (e.g. SYS stays SYS)', () => {
      expect(normalizeBPText('SYS 120')).toBe('SYS 120');
    });

    it('normalises B between digits to 8 (SSD misread)', () => {
      expect(normalizeBPText('1B4')).toBe('184');
    });

    it('does NOT convert B in labels (e.g. BPM stays BPM)', () => {
      expect(normalizeBPText('72 BPM')).toBe('72 BPM');
    });

    it('normalises D between digits to 0 (SSD misread)', () => {
      expect(normalizeBPText('1D0')).toBe('100');
    });

    it('does NOT convert D in labels (e.g. DIA stays DIA)', () => {
      expect(normalizeBPText('DIA 80')).toBe('DIA 80');
    });
  });

  // -------------------------------------------------------------------------
  describe('parseBPText with digitOnlyText', () => {
    it('uses digitOnlyText for Strategy 3 number extraction', () => {
      // Regular text has SSD misreads, digit-only text is clean
      const result = parseBPText('l34\n g3\n B7', '134\n 93\n 87');
      expect(result).toEqual(expect.objectContaining({
        systolic: '134', diastolic: '93', heartRate: '87',
      }));
      expect(result.strategy).toBe(3);
    });

    it('still uses regular text for Strategy 1 labels', () => {
      const result = parseBPText('SYS 120 DIA 80 PUL 72', '120 80 72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(1);
    });

    it('still uses regular text for Strategy 2 slash format', () => {
      const result = parseBPText('120/80 72BPM', '120 80 72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(2);
    });

    it('uses regular text for BPM detection in Strategy 3', () => {
      // Regular text has BPM label, digit-only doesn't
      const result = parseBPText('72 BPM\n120\n80', '72\n120\n80');
      expect(result.heartRate).toBe('72');
    });

    it('falls back to regular text when digitOnlyText is not provided', () => {
      const result = parseBPText('120\n80\n72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
      expect(result.strategy).toBe(3);
    });

    it('handles garbled regular text with clean digit-only text', () => {
      // Simulates heavily garbled OCR from seven-segment display
      const result = parseBPText('no valid numbers here', '135\n88\n72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '135', diastolic: '88', heartRate: '72',
      }));
      expect(result.strategy).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  describe('detectIrregularHeartbeat', () => {
    it('detects English IHB text', () => {
      expect(detectIrregularHeartbeat('SYS 120 DIA 80 PUL 72 IHB')).toBe(true);
    });

    it('detects IHB case-insensitively', () => {
      expect(detectIrregularHeartbeat('ihb detected')).toBe(true);
    });

    it('detects Traditional Chinese 不規則', () => {
      expect(detectIrregularHeartbeat('心律不規則')).toBe(true);
    });

    it('detects Simplified Chinese 不规则', () => {
      expect(detectIrregularHeartbeat('心律不规则')).toBe(true);
    });

    it('returns false when no IHB indicator is present', () => {
      expect(detectIrregularHeartbeat('SYS 120 DIA 80 PUL 72')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(detectIrregularHeartbeat('')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('stripDateTimePatterns', () => {
    it('strips ISO-style date (2024/01/15)', () => {
      const result = stripDateTimePatterns('2024/01/15 120 80 72');
      expect(result).not.toContain('2024');
      expect(result).toContain('120');
    });

    it('strips date with hyphens (2024-01-15)', () => {
      const result = stripDateTimePatterns('2024-01-15 120');
      expect(result).not.toContain('2024');
    });

    it('strips reversed date (15/01/2024)', () => {
      const result = stripDateTimePatterns('15/01/2024 120 80');
      expect(result).not.toContain('2024');
    });

    it('strips time patterns (12:30)', () => {
      const result = stripDateTimePatterns('12:30 120 80 72');
      expect(result).not.toContain('12:30');
      expect(result).toContain('120');
    });

    it('strips standalone 4-digit years', () => {
      const result = stripDateTimePatterns('2024 120 80 72');
      expect(result).not.toContain('2024');
      expect(result).toContain('120');
    });

    it('does not strip non-date numbers', () => {
      const result = stripDateTimePatterns('120 80 72');
      expect(result).toContain('120');
      expect(result).toContain('80');
      expect(result).toContain('72');
    });

    it('handles combined date and time', () => {
      const result = stripDateTimePatterns('2024/03/15 08:30 120 80 72');
      expect(result).toContain('120');
      expect(result).toContain('80');
    });
  });

  // -------------------------------------------------------------------------
  describe('parseBPText — IHB detection', () => {
    it('sets irregularHeartbeat when IHB text is present', () => {
      const result = parseBPText('SYS 120 DIA 80 PUL 72 IHB');
      expect(result.irregularHeartbeat).toBe(true);
      expect(result.systolic).toBe('120');
    });

    it('does not set irregularHeartbeat when IHB is absent', () => {
      const result = parseBPText('SYS 120 DIA 80 PUL 72');
      expect(result.irregularHeartbeat).toBeUndefined();
    });

    it('detects IHB with Chinese text', () => {
      const result = parseBPText('高压 120\n低压 80\n脉搏 72\n不规则');
      expect(result.irregularHeartbeat).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('parseBPText — date/time filtering', () => {
    it('filters out 4-digit years in Strategy 3 number extraction', () => {
      const result = parseBPText('2024\n120\n80\n72');
      expect(result.systolic).toBe('120');
      expect(result.diastolic).toBe('80');
      expect(result.heartRate).toBe('72');
    });

    it('filters date patterns with slashes (2024/01/15)', () => {
      const result = parseBPText('2024/01/15\n135\n88\n72');
      expect(result.systolic).toBe('135');
      expect(result.diastolic).toBe('88');
    });

    it('filters time patterns (12:30)', () => {
      const result = parseBPText('12:30\n120\n80\n72');
      expect(result.systolic).toBe('120');
      expect(result.diastolic).toBe('80');
    });

    it('does not interfere with labeled patterns (Strategy 1)', () => {
      const result = parseBPText('2024/01/15 SYS 120 DIA 80 PUL 72');
      expect(result.systolic).toBe('120');
      expect(result.diastolic).toBe('80');
      expect(result.heartRate).toBe('72');
      expect(result.strategy).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('parseBPText — edge cases', () => {
    it('handles completely blank text', () => {
      const result = parseBPText('   \n\n  ');
      expect(result.systolic).toBe('');
      expect(result.diastolic).toBe('');
      expect(result.heartRate).toBe('');
    });

    it('handles error codes like "E1" or "Er"', () => {
      const result = parseBPText('E1');
      expect(result.systolic).toBe('');
      expect(result.diastolic).toBe('');
    });

    it('handles error code "Er" without crashing', () => {
      const result = parseBPText('Er\nE2');
      expect(result.systolic).toBe('');
    });

    it('handles numbers outside physiological range', () => {
      const result = parseBPText('300\n10\n5');
      expect(result.systolic).toBe('');
      expect(result.diastolic).toBe('');
    });

    it('handles single number input', () => {
      const result = parseBPText('120');
      expect(result.systolic).toBe('');
      expect(result.diastolic).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  describe('parseBPFromWords', () => {
    function makeWord(text: string, y0: number, y1: number, confidence: number = 90): OcrWord {
      return {
        text,
        confidence,
        bbox: { x0: 10, y0, x1: 100, y1 },
      };
    }

    it('assigns systolic/diastolic/HR by bounding box height', () => {
      const words: OcrWord[] = [
        makeWord('120', 10, 80),   // tallest → systolic
        makeWord('80', 100, 150),  // medium → diastolic
        makeWord('72', 170, 200),  // smallest → heart rate
      ];
      const result = parseBPFromWords(words, '120\n80\n72');
      expect(result).toEqual(expect.objectContaining({
        systolic: '120', diastolic: '80', heartRate: '72',
      }));
    });

    it('filters out low-confidence words', () => {
      const words: OcrWord[] = [
        makeWord('120', 10, 80, 90),
        makeWord('80', 100, 150, 90),
        makeWord('23', 170, 200, 30),  // low confidence — should be filtered
      ];
      const result = parseBPFromWords(words, '120\n80\n23');
      expect(result.systolic).toBe('120');
      expect(result.diastolic).toBe('80');
    });

    it('falls back to parseBPText when insufficient digit words', () => {
      const words: OcrWord[] = [
        makeWord('hello', 10, 50, 90),
      ];
      const result = parseBPFromWords(words, 'SYS 120 DIA 80 PUL 72');
      expect(result.systolic).toBe('120');
      expect(result.strategy).toBe(1);
    });

    it('detects IHB from word-level text', () => {
      const words: OcrWord[] = [
        makeWord('120', 10, 80),
        makeWord('80', 100, 150),
        makeWord('72', 170, 200),
        makeWord('IHB', 210, 230, 80),
      ];
      const result = parseBPFromWords(words, '120\n80\n72\nIHB');
      expect(result.irregularHeartbeat).toBe(true);
    });
  });
});
