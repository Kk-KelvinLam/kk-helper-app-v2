import { describe, it, expect } from 'vitest';
import { combineBPReadings, isPlausibleBPReading, type BPReading } from './bpOcrUtils';

describe('combineBPReadings', () => {
  it('combines SYS + DIA + Pulse into a BPReading', () => {
    const result = combineBPReadings(120, 80, 72);
    expect(result).toEqual({ systolic: 120, diastolic: 80, pulse: 72 });
  });

  it('allows null pulse', () => {
    const result = combineBPReadings(130, 85);
    expect(result).toEqual({ systolic: 130, diastolic: 85, pulse: null });
  });

  it('allows zero values', () => {
    const result = combineBPReadings(0, 0, 0);
    expect(result).toEqual({ systolic: 0, diastolic: 0, pulse: 0 });
  });

  it('throws for systolic out of range', () => {
    expect(() => combineBPReadings(1000, 80)).toThrow('Systolic value out of range: 1000');
    expect(() => combineBPReadings(-1, 80)).toThrow('Systolic value out of range: -1');
  });

  it('throws for diastolic out of range', () => {
    expect(() => combineBPReadings(120, 1000)).toThrow('Diastolic value out of range: 1000');
    expect(() => combineBPReadings(120, -5)).toThrow('Diastolic value out of range: -5');
  });

  it('throws for pulse out of range', () => {
    expect(() => combineBPReadings(120, 80, 1000)).toThrow('Pulse value out of range: 1000');
    expect(() => combineBPReadings(120, 80, -1)).toThrow('Pulse value out of range: -1');
  });
});

describe('isPlausibleBPReading', () => {
  it('returns true for normal BP', () => {
    const reading: BPReading = { systolic: 120, diastolic: 80, pulse: 72 };
    expect(isPlausibleBPReading(reading)).toBe(true);
  });

  it('returns true for high BP with null pulse', () => {
    const reading: BPReading = { systolic: 180, diastolic: 110, pulse: null };
    expect(isPlausibleBPReading(reading)).toBe(true);
  });

  it('returns false when systolic <= diastolic', () => {
    expect(isPlausibleBPReading({ systolic: 80, diastolic: 80, pulse: null })).toBe(false);
    expect(isPlausibleBPReading({ systolic: 70, diastolic: 80, pulse: null })).toBe(false);
  });

  it('returns false for implausibly low systolic', () => {
    expect(isPlausibleBPReading({ systolic: 50, diastolic: 40, pulse: null })).toBe(false);
  });

  it('returns false for implausibly high systolic', () => {
    expect(isPlausibleBPReading({ systolic: 350, diastolic: 80, pulse: null })).toBe(false);
  });

  it('returns false for implausibly low diastolic', () => {
    expect(isPlausibleBPReading({ systolic: 120, diastolic: 25, pulse: null })).toBe(false);
  });

  it('returns false for implausibly high diastolic', () => {
    expect(isPlausibleBPReading({ systolic: 250, diastolic: 210, pulse: null })).toBe(false);
  });

  it('returns false for pulse out of physiological range', () => {
    expect(isPlausibleBPReading({ systolic: 120, diastolic: 80, pulse: 20 })).toBe(false);
    expect(isPlausibleBPReading({ systolic: 120, diastolic: 80, pulse: 260 })).toBe(false);
  });

  it('returns true at boundary values', () => {
    expect(isPlausibleBPReading({ systolic: 61, diastolic: 30, pulse: 30 })).toBe(true);
    expect(isPlausibleBPReading({ systolic: 300, diastolic: 200, pulse: 250 })).toBe(true);
  });
});
