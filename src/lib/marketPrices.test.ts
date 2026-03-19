import { describe, it, expect } from 'vitest';
import { getMarketPrices, searchMarketPrices, filterByCategory, getMarketPriceCategories } from '@/lib/marketPrices';

describe('marketPrices', () => {
  describe('getMarketPrices', () => {
    it('returns an array of market prices', () => {
      const prices = getMarketPrices();
      expect(prices).toBeInstanceOf(Array);
      expect(prices.length).toBeGreaterThan(0);
    });

    it('each price has required fields', () => {
      const prices = getMarketPrices();
      for (const price of prices) {
        expect(price).toHaveProperty('itemName');
        expect(price).toHaveProperty('price');
        expect(price).toHaveProperty('unit');
        expect(price).toHaveProperty('source');
        expect(price).toHaveProperty('date');
        expect(typeof price.price).toBe('number');
        expect(price.price).toBeGreaterThan(0);
      }
    });
  });

  describe('searchMarketPrices', () => {
    it('finds items by Chinese name', () => {
      const results = searchMarketPrices('菜心');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].itemName).toContain('菜心');
    });

    it('finds items by English name', () => {
      const results = searchMarketPrices('Apple');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].itemName).toContain('Apple');
    });

    it('returns empty array for non-matching query', () => {
      const results = searchMarketPrices('xyznonexistent');
      expect(results).toEqual([]);
    });

    it('is case-insensitive', () => {
      const upper = searchMarketPrices('APPLE');
      const lower = searchMarketPrices('apple');
      expect(upper).toEqual(lower);
    });
  });

  describe('getMarketPriceCategories', () => {
    it('returns an array of category strings', () => {
      const cats = getMarketPriceCategories();
      expect(cats).toBeInstanceOf(Array);
      expect(cats.length).toBeGreaterThan(0);
      expect(cats).toContain('全部 All');
    });
  });

  describe('filterByCategory', () => {
    it('returns all items for "全部 All"', () => {
      const all = filterByCategory('全部 All');
      const full = getMarketPrices();
      expect(all).toEqual(full);
    });

    it('filters vegetables correctly', () => {
      const vegs = filterByCategory('蔬菜 Vegetables');
      expect(vegs.length).toBeGreaterThan(0);
      for (const v of vegs) {
        expect(v.source).toContain('街市');
      }
    });

    it('filters fruits correctly', () => {
      const fruits = filterByCategory('水果 Fruits');
      expect(fruits.length).toBeGreaterThan(0);
    });

    it('returns empty array for unknown category', () => {
      const results = filterByCategory('Unknown Category');
      expect(results).toEqual([]);
    });
  });
});
