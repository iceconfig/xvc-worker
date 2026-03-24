import { describe, it, expect, vi } from 'vitest';
import { handleStreamRequest } from '../src/controllers/stream';

describe('handleStreamRequest', () => {
  it('returns 405 for non-POST methods', async () => {
    const request = new Request('http://example.com/deepseek', { method: 'GET' });
    const response = await handleStreamRequest(request, 'fake-key');
    expect(response.status).toBe(405);
    expect(await response.text()).toBe('Method not allowed');
  });

  it('returns 405 for PUT method', async () => {
    const request = new Request('http://example.com/deepseek', { method: 'PUT' });
    const response = await handleStreamRequest(request, 'fake-key');
    expect(response.status).toBe(405);
  });

  it('returns 405 for DELETE method', async () => {
    const request = new Request('http://example.com/deepseek', { method: 'DELETE' });
    const response = await handleStreamRequest(request, 'fake-key');
    expect(response.status).toBe(405);
  });

  it('returns 400 when prompt is missing', async () => {
    const request = new Request('http://example.com/deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const response = await handleStreamRequest(request, 'fake-key');
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Missing prompt');
  });

  it('returns 400 when prompt is empty', async () => {
    const request = new Request('http://example.com/deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '' }),
    });
    const response = await handleStreamRequest(request, 'fake-key');
    expect(response.status).toBe(400);
  });

  it('returns 500 when API key is not configured', async () => {
    const request = new Request('http://example.com/deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test prompt' }),
    });
    const response = await handleStreamRequest(request, '');
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('API_KEY not configured');
  });

  it('returns streaming response for valid request', async () => {
    const request = new Request('http://example.com/deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test prompt' }),
    });
    const response = await handleStreamRequest(request, 'fake-key');
    // Response should be a stream (body is not null)
    expect(response.body).not.toBeNull();
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
  });
});
