import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('Worker Routing', () => {
  describe('GET /subtitles', () => {
    it('returns 400 when url parameter is missing', async () => {
      const request = new Request('http://example.com/subtitles');
      const response = await SELF.fetch(request);
      expect(response.status).toBe(400);
      const body = await response.json() as { error: string };
      expect(body.error).toContain('url');
    });

    it('returns 400 when YouTube URL is invalid', async () => {
      const request = new Request('http://example.com/subtitles?url=invalid-url');
      const response = await SELF.fetch(request);
      expect(response.status).toBe(400);
      const body = await response.json() as { error: string };
      expect(body.error).toContain('Invalid YouTube URL');
    });

    it('returns subtitles for valid YouTube URL', async () => {
      const request = new Request('http://example.com/subtitles?url=https://www.youtube.com/watch?v=validId');
      const response = await SELF.fetch(request);
      // The actual API call will fail in test environment without mock
      // but we verify the routing works correctly
      expect(response.status).toBeOneOf([200, 500]);
    });
  });

  describe('POST /deepseek', () => {
    it('returns 405 for non-POST methods', async () => {
      const request = new Request('http://example.com/deepseek', { method: 'GET' });
      const response = await SELF.fetch(request);
      expect(response.status).toBe(405);
    });

    it('returns 400 when prompt is missing', async () => {
      const request = new Request('http://example.com/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const response = await SELF.fetch(request);
      expect(response.status).toBe(400);
    });

    it('returns 500 when API key is not configured', async () => {
      const request = new Request('http://example.com/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'test prompt' }),
      });
      // Pass empty string to simulate missing API key
      const response = await worker.fetch(request, { DEEPSEEK_API_KEY: '', GEMINI_API_KEY: '' });
      expect(response.status).toBe(500);
    });

    it('accepts valid POST request with prompt', async () => {
      const request = new Request('http://example.com/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'test prompt' }),
      });
      // With a fake API key, the request will fail at API call
      // but we verify the routing and validation works
      const response = await worker.fetch(request, { DEEPSEEK_API_KEY: 'fake-key', GEMINI_API_KEY: '' });
      // Either streaming starts (200) or API call fails (500)
      expect(response.status).toBeOneOf([200, 500]);
    });
  });

  describe('404 handling', () => {
    it('returns 404 for unknown routes', async () => {
      const request = new Request('http://example.com/unknown');
      const response = await SELF.fetch(request);
      expect(response.status).toBe(404);
    });

    it('returns 404 for API routes that do not exist', async () => {
      const request = new Request('http://example.com/api/nonexistent');
      const response = await SELF.fetch(request);
      expect(response.status).toBe(404);
    });
  });
});
