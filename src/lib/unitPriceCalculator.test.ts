import { describe, it, expect } from 'vitest';
import {
  calculateUnitPrices,
  convertToBase,
  getBaseUnitLabel,
  areUnitsComparable,
  SUPPORTED_UNITS,
  type UnitPriceItem,
} from '@/lib/unitPriceCalculator';

describe('unitPriceCalculator', () => {
  describe('convertToBase', () => {
    it('converts grams to grams (1:1)', () => {
      expect(convertToBase(100, 'g')).toBe(100);
    });

    it('converts kilograms to grams', () => {
      expect(convertToBase(1, 'kg')).toBe(1000);
      expect(convertToBase(2.5, 'kg')).toBe(2500);
    });

    it('converts catty (斤) to grams', () => {
      const result = convertToBase(1, 'catty');
      expect(result).toBeCloseTo(604.79, 1);
    });

    it('converts tael (兩) to grams', () => {
      const result = convertToBase(1, 'tael');
      expect(result).toBeCloseTo(37.799, 1);
    });

    it('converts pounds to grams', () => {
      const result = convertToBase(1, 'lb');
      expect(result).toBeCloseTo(453.592, 1);
    });

    it('converts ounces to grams', () => {
      const result = convertToBase(1, 'oz');
      expect(result).toBeCloseTo(28.3495, 1);
    });

    it('converts litres to mL', () => {
      expect(convertToBase(1, 'L')).toBe(1000);
    });

    it('converts mL to mL (1:1)', () => {
      expect(convertToBase(500, 'mL')).toBe(500);
    });

    it('handles count units (piece/pack)', () => {
      expect(convertToBase(3, 'piece')).toBe(3);
      expect(convertToBase(5, 'pack')).toBe(5);
    });
  });

  describe('getBaseUnitLabel', () => {
    it('returns /g for weight units', () => {
      expect(getBaseUnitLabel('g')).toBe('/g');
      expect(getBaseUnitLabel('kg')).toBe('/g');
      expect(getBaseUnitLabel('catty')).toBe('/g');
      expect(getBaseUnitLabel('lb')).toBe('/g');
    });

    it('returns /mL for volume units', () => {
      expect(getBaseUnitLabel('mL')).toBe('/mL');
      expect(getBaseUnitLabel('L')).toBe('/mL');
    });

    it('returns /unit for count units', () => {
      expect(getBaseUnitLabel('piece')).toBe('/unit');
      expect(getBaseUnitLabel('pack')).toBe('/unit');
    });
  });

  describe('areUnitsComparable', () => {
    it('weight units are comparable to each other', () => {
      expect(areUnitsComparable('g', 'kg')).toBe(true);
      expect(areUnitsComparable('catty', 'lb')).toBe(true);
    });

    it('volume units are comparable to each other', () => {
      expect(areUnitsComparable('mL', 'L')).toBe(true);
    });

    it('weight and volume units are not comparable', () => {
      expect(areUnitsComparable('g', 'mL')).toBe(false);
    });

    it('count and weight units are not comparable', () => {
      expect(areUnitsComparable('piece', 'kg')).toBe(false);
    });
  });

  describe('calculateUnitPrices', () => {
    it('returns empty array for empty items', () => {
      expect(calculateUnitPrices([])).toEqual([]);
    });

    it('returns empty array when items have no valid data', () => {
      const items: UnitPriceItem[] = [
        { id: '1', name: 'A', price: '', quantity: '', unit: 'g' },
        { id: '2', name: 'B', price: '0', quantity: '100', unit: 'g' },
      ];
      expect(calculateUnitPrices(items)).toEqual([]);
    });

    it('calculates unit price correctly for grams', () => {
      const items: UnitPriceItem[] = [
        { id: '1', name: 'Product A', price: '10', quantity: '500', unit: 'g' },
      ];
      const results = calculateUnitPrices(items);
      expect(results).toHaveLength(1);
      expect(results[0].pricePerGram).toBeCloseTo(0.02, 4);
    });

    it('identifies the best deal among same-type units', () => {
      const items: UnitPriceItem[] = [
        { id: '1', name: 'Cheap', price: '10', quantity: '1', unit: 'kg' },
        { id: '2', name: 'Expensive', price: '20', quantity: '1', unit: 'kg' },
      ];
      const results = calculateUnitPrices(items);
      expect(results).toHaveLength(2);

      const cheap = results.find((r) => r.id === '1');
      const expensive = results.find((r) => r.id === '2');
      expect(cheap?.isBestDeal).toBe(true);
      expect(expensive?.isBestDeal).toBe(false);
    });

    it('compares across different weight units correctly', () => {
      const items: UnitPriceItem[] = [
        { id: '1', name: 'By kg', price: '50', quantity: '1', unit: 'kg' },
        { id: '2', name: 'By catty', price: '40', quantity: '1', unit: 'catty' },
      ];
      const results = calculateUnitPrices(items);

      // 50/1000g = 0.05/g vs 40/604.79g ≈ 0.0661/g → kg is cheaper
      const byKg = results.find((r) => r.id === '1');
      const byCatty = results.find((r) => r.id === '2');
      expect(byKg?.isBestDeal).toBe(true);
      expect(byCatty?.isBestDeal).toBe(false);
    });

    it('does not compare across different unit types', () => {
      const items: UnitPriceItem[] = [
        { id: '1', name: 'Weight item', price: '10', quantity: '100', unit: 'g' },
        { id: '2', name: 'Count item', price: '5', quantity: '1', unit: 'piece' },
      ];
      const results = calculateUnitPrices(items);
      // Both should be best deal in their respective groups
      expect(results.find((r) => r.id === '1')?.isBestDeal).toBe(true);
      expect(results.find((r) => r.id === '2')?.isBestDeal).toBe(true);
    });

    it('skips items with missing quantity or price', () => {
      const items: UnitPriceItem[] = [
        { id: '1', name: 'Valid', price: '10', quantity: '100', unit: 'g' },
        { id: '2', name: 'Missing qty', price: '10', quantity: '', unit: 'g' },
        { id: '3', name: 'Missing price', price: '', quantity: '100', unit: 'g' },
      ];
      const results = calculateUnitPrices(items);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });
  });

  describe('SUPPORTED_UNITS', () => {
    it('has at least 8 supported units', () => {
      expect(SUPPORTED_UNITS.length).toBeGreaterThanOrEqual(8);
    });

    it('includes common weight units', () => {
      const values = SUPPORTED_UNITS.map((u) => u.value);
      expect(values).toContain('g');
      expect(values).toContain('kg');
      expect(values).toContain('catty');
      expect(values).toContain('lb');
    });

    it('includes volume units', () => {
      const values = SUPPORTED_UNITS.map((u) => u.value);
      expect(values).toContain('mL');
      expect(values).toContain('L');
    });
  });
});
