import { describe, it, expect } from 'vitest';
import { extractVideoId } from '../src/utils/url';

describe('extractVideoId', () => {
  it('extracts video ID from youtube.com/watch?v=VIDEO_ID', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('http://youtube.com/watch?v=abc123')).toBe('abc123');
    expect(extractVideoId('https://youtube.com/watch?v=xyz789&feature=share')).toBe('xyz789');
  });

  it('extracts video ID from youtu.be/VIDEO_ID', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('http://youtu.be/abc123')).toBe('abc123');
    expect(extractVideoId('https://youtu.be/xyz789?t=42')).toBe('xyz789');
  });

  it('extracts video ID from youtube.com/embed/VIDEO_ID', () => {
    expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('http://youtube.com/embed/abc123')).toBe('abc123');
    expect(extractVideoId('https://youtube.com/embed/xyz789?autoplay=1')).toBe('xyz789');
  });

  it('extracts video ID from youtube.com/v/VIDEO_ID', () => {
    expect(extractVideoId('https://www.youtube.com/v/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('http://youtube.com/v/abc123')).toBe('abc123');
  });

  it('returns null for invalid URLs', () => {
    expect(extractVideoId('invalid-url')).toBe(null);
    expect(extractVideoId('https://example.com')).toBe(null);
    expect(extractVideoId('https://youtube.com')).toBe(null);
    expect(extractVideoId('')).toBe(null);
  });

  it('handles URLs with additional query parameters', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=abc123&list=PLxyz&index=1')).toBe('abc123');
    expect(extractVideoId('https://youtu.be/abc123?feature=share&t=30')).toBe('abc123');
  });
});
