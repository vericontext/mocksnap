import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp, createMockViaAPI, SAMPLE_DATA } from './setup.js';
import type { Hono } from 'hono';

let app: Hono;
let mockId: string;

beforeAll(async () => {
  app = createTestApp();
  const { data } = await createMockViaAPI(app, {
    name: 'Query Test',
    sample: SAMPLE_DATA,
    amplify: false,
  });
  mockId = data.id;
});

describe('Query Features', () => {
  it('filters by exact value', async () => {
    const res = await app.request(`/m/${mockId}/users?name=Alex+Johnson`);
    const data = await res.json() as any[];

    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Alex Johnson');
  });

  it('filters by gte operator', async () => {
    const res = await app.request(`/m/${mockId}/users?age_gte=30`);
    const data = await res.json() as any[];

    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Sarah Miller');
  });

  it('filters by lte operator', async () => {
    const res = await app.request(`/m/${mockId}/users?age_lte=26`);
    const data = await res.json() as any[];

    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('James Wilson');
  });

  it('sorts ascending', async () => {
    const res = await app.request(`/m/${mockId}/users?sort=age&order=asc`);
    const data = await res.json() as any[];

    expect(data[0].name).toBe('James Wilson'); // 25
    expect(data[2].name).toBe('Sarah Miller'); // 32
  });

  it('sorts descending', async () => {
    const res = await app.request(`/m/${mockId}/users?sort=age&order=desc`);
    const data = await res.json() as any[];

    expect(data[0].name).toBe('Sarah Miller'); // 32
    expect(data[2].name).toBe('James Wilson'); // 25
  });

  it('paginates with page and limit', async () => {
    const res = await app.request(`/m/${mockId}/users?page=1&limit=2`);
    const data = await res.json() as any[];

    expect(data).toHaveLength(2);
    expect(res.headers.get('X-Total-Count')).toBe('3');
  });

  it('returns Link header for pagination', async () => {
    const res = await app.request(`/m/${mockId}/users?page=1&limit=2`);
    const link = res.headers.get('Link');

    expect(link).toContain('rel="next"');
    expect(link).toContain('rel="last"');
  });

  it('searches with q parameter', async () => {
    const res = await app.request(`/m/${mockId}/users?q=alex`);
    const data = await res.json() as any[];

    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].email).toContain('alex');
  });

  it('selects fields', async () => {
    const res = await app.request(`/m/${mockId}/users?fields=id,name`);
    const data = await res.json() as any[];

    expect(Object.keys(data[0])).toEqual(['id', 'name']);
    expect(data[0].email).toBeUndefined();
  });

  it('returns nested resources', async () => {
    const res = await app.request(`/m/${mockId}/users/1/posts`);
    const data = await res.json() as any[];

    expect(data).toHaveLength(1);
    expect(data[0].userId).toBe(1);
  });

  it('expands FK relations', async () => {
    const res = await app.request(`/m/${mockId}/posts?_expand=user`);
    const data = await res.json() as any[];

    expect(data[0].user).toBeDefined();
    expect(data[0].user.name).toBe('Alex Johnson');
  });

  it('embeds child resources', async () => {
    const res = await app.request(`/m/${mockId}/users/1?_embed=posts`);
    const data = await res.json() as any;

    expect(data.posts).toBeDefined();
    expect(Array.isArray(data.posts)).toBe(true);
    expect(data.posts.length).toBeGreaterThanOrEqual(1);
  });
});
