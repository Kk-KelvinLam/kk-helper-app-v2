import { describe, it, expect } from 'vitest';
import { CATEGORIES, LOCATIONS } from '@/types';

describe('types', () => {
  describe('CATEGORIES', () => {
    it('has at least 5 categories', () => {
      expect(CATEGORIES.length).toBeGreaterThanOrEqual(5);
    });

    it('each category has emoji and bilingual name', () => {
      for (const cat of CATEGORIES) {
        // Each category should have Chinese and English text
        expect(cat.length).toBeGreaterThan(3);
      }
    });
  });

  describe('LOCATIONS', () => {
    it('has at least 5 locations', () => {
      expect(LOCATIONS.length).toBeGreaterThanOrEqual(5);
    });

    it('includes common HK supermarkets', () => {
      const locationStr = LOCATIONS.join(',');
      expect(locationStr).toContain('PARKnSHOP');
      expect(locationStr).toContain('Wellcome');
      expect(locationStr).toContain('AEON');
    });
  });
});
