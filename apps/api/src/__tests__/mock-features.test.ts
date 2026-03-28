import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp, createMockViaAPI, SAMPLE_DATA } from './setup.js';
import type { Hono } from 'hono';

let app: Hono;
let mockId: string;

beforeAll(async () => {
  app = createTestApp();
  const { data } = await createMockViaAPI(app, {
    name: 'Features Test',
    sample: SAMPLE_DATA,
    amplify: false,
  });
  mockId = data.id;
});

describe('ETag & Conditional Requests', () => {
  it('returns ETag header on GET', async () => {
    const res = await app.request(`/m/${mockId}/users`);
    const etag = res.headers.get('ETag');

    expect(etag).toBeDefined();
    expect(etag).toMatch(/^"[a-f0-9]+"$/);
  });

  it('returns 304 Not Modified with matching If-None-Match', async () => {
    const res1 = await app.request(`/m/${mockId}/users`);
    const etag = res1.headers.get('ETag')!;

    const res2 = await app.request(`/m/${mockId}/users`, {
      headers: { 'If-None-Match': etag },
    });

    expect(res2.status).toBe(304);
  });

  it('returns 200 with non-matching ETag', async () => {
    const res = await app.request(`/m/${mockId}/users`, {
      headers: { 'If-None-Match': '"wrong-etag"' },
    });

    expect(res.status).toBe(200);
  });
});

describe('Auto Timestamps', () => {
  it('adds createdAt and updatedAt on POST', async () => {
    const res = await app.request(`/m/${mockId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 100, name: 'Timestamp Test' }),
    });
    const data = await res.json() as any;

    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
    expect(data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('updates updatedAt on PATCH', async () => {
    const postRes = await app.request(`/m/${mockId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 101, name: 'Before Patch' }),
    });
    const original = await postRes.json() as any;

    // Small delay
    await new Promise((r) => setTimeout(r, 10));

    const patchRes = await app.request(`/m/${mockId}/users/101`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'After Patch' }),
    });
    const patched = await patchRes.json() as any;

    expect(patched.name).toBe('After Patch');
    expect(patched.updatedAt).toBeDefined();
    expect(patched.createdAt).toBe(original.createdAt);
  });
});

describe('Idempotency Key', () => {
  it('prevents duplicate POST with same key', async () => {
    const body = JSON.stringify({ id: 200, name: 'Idempotent User' });
    const headers = {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'test-key-123',
    };

    const res1 = await app.request(`/m/${mockId}/users`, { method: 'POST', headers, body });
    const data1 = await res1.json() as any;
    expect(res1.status).toBe(201);

    const res2 = await app.request(`/m/${mockId}/users`, { method: 'POST', headers, body });
    const data2 = await res2.json() as any;

    // Second request returns cached response, same data
    expect(data2.name).toBe(data1.name);
    expect(data2.id).toBe(data1.id);
  });
});

describe('Auth Simulation', () => {
  it('returns 401 without token when auth is configured', async () => {
    // Set auth config
    await app.request(`/api/mocks/${mockId}/resources/users/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth: { type: 'bearer', key: 'secret123' } }),
    });

    const res = await app.request(`/m/${mockId}/users`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with correct token', async () => {
    const res = await app.request(`/m/${mockId}/users`, {
      headers: { Authorization: 'Bearer secret123' },
    });
    expect(res.status).toBe(200);
  });

  it('returns 401 with wrong token', async () => {
    const res = await app.request(`/m/${mockId}/users`, {
      headers: { Authorization: 'Bearer wrong' },
    });
    expect(res.status).toBe(401);
  });

  // Clean up auth
  it('removes auth config', async () => {
    await app.request(`/api/mocks/${mockId}/resources/users/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth: null }),
    });

    const res = await app.request(`/m/${mockId}/users`);
    expect(res.status).toBe(200);
  });
});

describe('Envelope Mode', () => {
  it('wraps list response in { data, meta, links }', async () => {
    // Enable envelope
    await app.request(`/api/mocks/${mockId}/resources/users/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ envelope: true }),
    });

    const res = await app.request(`/m/${mockId}/users?page=1&limit=2`);
    const data = await res.json() as any;

    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBeGreaterThanOrEqual(3);
    expect(data.meta.page).toBe(1);
    expect(data.meta.limit).toBe(2);
    expect(data.links).toBeDefined();
    expect(data.links.next).toBeDefined();

    // Clean up
    await app.request(`/api/mocks/${mockId}/resources/users/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ envelope: false }),
    });
  });
});

describe('RFC 7807 Error Format', () => {
  it('returns problem details for 404', async () => {
    const res = await app.request(`/m/${mockId}/users/99999`);
    const data = await res.json() as any;

    expect(res.status).toBe(404);
    expect(data.type).toContain('httpstatuses.com/404');
    expect(data.title).toBe('Not Found');
    expect(data.status).toBe(404);
    expect(data.detail).toBeDefined();
    expect(data.instance).toBeDefined();
  });
});

describe('Rate Limit Headers', () => {
  it('includes X-RateLimit headers on responses', async () => {
    const res = await app.request(`/m/${mockId}/users`);

    expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
  });
});

describe('Location Header', () => {
  it('includes Location header on POST 201', async () => {
    const res = await app.request(`/m/${mockId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 300, name: 'Location Test' }),
    });

    expect(res.status).toBe(201);
    expect(res.headers.get('Location')).toContain(`/m/${mockId}/users/300`);
  });
});

describe('GraphQL', () => {
  it('returns data via GraphQL query', async () => {
    const res = await app.request(`/m/${mockId}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ users { id name } }' }),
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.data.users).toBeDefined();
    expect(data.data.users.length).toBeGreaterThanOrEqual(1);
  });
});

describe('OpenAPI & Docs', () => {
  it('returns OpenAPI spec', async () => {
    const res = await app.request(`/m/${mockId}/openapi.json`);
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.openapi).toBe('3.0.3');
    expect(data.paths).toBeDefined();
    expect(data.components.schemas).toBeDefined();
  });

  it('returns docs HTML', async () => {
    const res = await app.request(`/m/${mockId}/docs`);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('api-reference');
    expect(html).toContain('scalar');
  });

  it('returns Mermaid ER diagram', async () => {
    const res = await app.request(`/m/${mockId}/diagram`);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('erDiagram');
    expect(text).toContain('users');
    expect(text).toContain('posts');
  });
});
