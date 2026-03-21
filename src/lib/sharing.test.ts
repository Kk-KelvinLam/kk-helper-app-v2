import { describe, it, expect } from 'vitest';
import { encodeQRData, decodeQRData } from './sharing';
import type { User } from '@/types';

describe('QR Code encoding/decoding', () => {
  const mockUser: User = {
    uid: 'user123',
    displayName: 'Test User',
    email: 'test@example.com',
    photoURL: 'https://example.com/photo.jpg',
  };

  it('should encode user data to a JSON string', () => {
    const encoded = encodeQRData(mockUser);
    const parsed = JSON.parse(encoded);
    expect(parsed.type).toBe('kk-helper-share');
    expect(parsed.uid).toBe('user123');
    expect(parsed.displayName).toBe('Test User');
    expect(parsed.email).toBe('test@example.com');
  });

  it('should decode valid QR data back to user info', () => {
    const encoded = encodeQRData(mockUser);
    const decoded = decodeQRData(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.uid).toBe('user123');
    expect(decoded!.displayName).toBe('Test User');
    expect(decoded!.email).toBe('test@example.com');
    expect(decoded!.photoURL).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    expect(decodeQRData('not-json')).toBeNull();
  });

  it('should return null for JSON without kk-helper-share type', () => {
    expect(decodeQRData(JSON.stringify({ type: 'other', uid: '123' }))).toBeNull();
  });

  it('should return null for JSON without uid', () => {
    expect(decodeQRData(JSON.stringify({ type: 'kk-helper-share' }))).toBeNull();
  });

  it('should handle user with null displayName and email', () => {
    const userWithNulls: User = {
      uid: 'user456',
      displayName: null,
      email: null,
      photoURL: null,
    };
    const encoded = encodeQRData(userWithNulls);
    const parsed = JSON.parse(encoded);
    expect(parsed.displayName).toBe('');
    expect(parsed.email).toBe('');

    const decoded = decodeQRData(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.uid).toBe('user456');
    expect(decoded!.displayName).toBeNull();
    expect(decoded!.email).toBeNull();
  });

  it('should roundtrip encode and decode correctly', () => {
    const encoded = encodeQRData(mockUser);
    const decoded = decodeQRData(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.uid).toBe(mockUser.uid);
  });
});
