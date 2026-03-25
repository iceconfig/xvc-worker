import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('Task API', () => {
  describe('POST /analyze', () => {
    it('creates a task and returns task_id, ws_url, status_url', async () => {
      const request = new Request('http://example.com/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        }),
      });

      const response = await SELF.fetch(request);
      expect(response.status).toBe(202);

      const body = await response.json();
      expect(body).toHaveProperty('task_id');
      expect(body).toHaveProperty('ws_url');
      expect(body).toHaveProperty('status_url');
      expect(body.ws_url).toMatch(/ws:\/\/.*\/ws\//);
      expect(body.status_url).toMatch(/http:\/\/.*\/task\//);
    });

    it('returns 400 when url is missing', async () => {
      const request = new Request('http://example.com/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await SELF.fetch(request);
      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid YouTube URL', async () => {
      const request = new Request('http://example.com/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-youtube-url' }),
      });

      const response = await SELF.fetch(request);
      expect(response.status).toBe(400);
    });

    it('returns 405 for non-POST method', async () => {
      const request = new Request('http://example.com/analyze', {
        method: 'GET',
      });

      const response = await SELF.fetch(request);
      expect(response.status).toBe(405);
    });
  });

  describe('GET /task/:id', () => {
    it('returns 200 with default status for new task', async () => {
      // Note: Durable Objects create new instances on demand,
      // so a non-existent task will return default status
      const request = new Request('http://example.com/task/new-task-id');
      const response = await SELF.fetch(request);
      expect(response.status).toBe(200);
      const body = await response.json() as { status: string; progress: number };
      expect(body.status).toBe('pending');
      expect(body.progress).toBe(0);
    });
  });

  describe('GET /ws/:id', () => {
    it('returns 101 for WebSocket upgrade with proper headers', async () => {
      const request = new Request('http://example.com/ws/test-id', {
        headers: {
          Upgrade: 'websocket',
        },
      });
      const response = await SELF.fetch(request);
      expect(response.status).toBe(101);
    });
  });
});
