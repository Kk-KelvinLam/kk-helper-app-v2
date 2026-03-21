import { describe, it, expect } from 'vitest';
import { classifyBP, getBPCategoryColor, analyzeBPRecords } from './bloodPressure';
import type { BloodPressureRecord } from '@/types';

describe('bloodPressure', () => {
  describe('classifyBP', () => {
    it('classifies normal blood pressure', () => {
      expect(classifyBP(110, 70)).toBe('normal');
      expect(classifyBP(119, 79)).toBe('normal');
      expect(classifyBP(90, 60)).toBe('normal');
    });

    it('classifies elevated blood pressure', () => {
      expect(classifyBP(120, 70)).toBe('elevated');
      expect(classifyBP(125, 75)).toBe('elevated');
      expect(classifyBP(129, 79)).toBe('elevated');
    });

    it('does not classify as elevated when diastolic >= 80', () => {
      expect(classifyBP(125, 80)).not.toBe('elevated');
    });

    it('classifies hypertension stage 1', () => {
      expect(classifyBP(130, 80)).toBe('hypertension1');
      expect(classifyBP(135, 85)).toBe('hypertension1');
      expect(classifyBP(139, 89)).toBe('hypertension1');
    });

    it('classifies hypertension stage 2', () => {
      expect(classifyBP(140, 90)).toBe('hypertension2');
      expect(classifyBP(150, 95)).toBe('hypertension2');
      expect(classifyBP(170, 110)).toBe('hypertension2');
    });

    it('classifies hypertensive crisis', () => {
      expect(classifyBP(181, 100)).toBe('crisis');
      expect(classifyBP(150, 121)).toBe('crisis');
      expect(classifyBP(200, 130)).toBe('crisis');
    });
  });

  describe('getBPCategoryColor', () => {
    it('returns green for normal', () => {
      expect(getBPCategoryColor('normal')).toBe('#22c55e');
    });

    it('returns yellow for elevated', () => {
      expect(getBPCategoryColor('elevated')).toBe('#eab308');
    });

    it('returns orange for hypertension1', () => {
      expect(getBPCategoryColor('hypertension1')).toBe('#f97316');
    });

    it('returns red for hypertension2', () => {
      expect(getBPCategoryColor('hypertension2')).toBe('#ef4444');
    });

    it('returns dark red for crisis', () => {
      expect(getBPCategoryColor('crisis')).toBe('#dc2626');
    });
  });

  describe('analyzeBPRecords', () => {
    it('returns null for empty records', () => {
      expect(analyzeBPRecords([])).toBeNull();
    });

    it('calculates correct statistics', () => {
      const records: BloodPressureRecord[] = [
        {
          id: '1', userId: 'u1', systolic: 120, diastolic: 80, heartRate: 72,
          measuredAt: new Date(), arm: 'left', position: 'sitting',
          notes: '', imageUrl: '', isShared: false,
          createdAt: new Date(), updatedAt: new Date(),
        },
        {
          id: '2', userId: 'u1', systolic: 130, diastolic: 85, heartRate: 78,
          measuredAt: new Date(), arm: 'left', position: 'sitting',
          notes: '', imageUrl: '', isShared: false,
          createdAt: new Date(), updatedAt: new Date(),
        },
        {
          id: '3', userId: 'u1', systolic: 110, diastolic: 70, heartRate: 65,
          measuredAt: new Date(), arm: 'left', position: 'sitting',
          notes: '', imageUrl: '', isShared: false,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ];

      const result = analyzeBPRecords(records);
      expect(result).not.toBeNull();
      expect(result!.totalRecords).toBe(3);
      expect(result!.avgSystolic).toBe(120);
      expect(result!.avgDiastolic).toBe(78);
      expect(result!.avgHeartRate).toBe(72);
      expect(result!.minSystolic).toBe(110);
      expect(result!.maxSystolic).toBe(130);
      expect(result!.minDiastolic).toBe(70);
      expect(result!.maxDiastolic).toBe(85);
      expect(result!.minHeartRate).toBe(65);
      expect(result!.maxHeartRate).toBe(78);
    });

    it('counts categories correctly', () => {
      const records: BloodPressureRecord[] = [
        {
          id: '1', userId: 'u1', systolic: 110, diastolic: 70, heartRate: 72,
          measuredAt: new Date(), arm: 'left', position: 'sitting',
          notes: '', imageUrl: '', isShared: false,
          createdAt: new Date(), updatedAt: new Date(),
        },
        {
          id: '2', userId: 'u1', systolic: 140, diastolic: 90, heartRate: 80,
          measuredAt: new Date(), arm: 'left', position: 'sitting',
          notes: '', imageUrl: '', isShared: false,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ];

      const result = analyzeBPRecords(records);
      expect(result).not.toBeNull();
      expect(result!.categoryCount.normal).toBe(1);
      expect(result!.categoryCount.hypertension2).toBe(1);
    });
  });
});
