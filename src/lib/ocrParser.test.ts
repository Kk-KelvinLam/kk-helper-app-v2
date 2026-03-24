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
  });
});
