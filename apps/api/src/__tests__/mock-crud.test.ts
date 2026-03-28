import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp, createMockViaAPI, SAMPLE_DATA } from './setup.js';
import type { Hono } from 'hono';

let app: Hono;
let mockId: string;

beforeAll(() => {
  app = createTestApp();
});

describe('Mock CRUD', () => {
  it('creates a mock from JSON sample', async () => {
    const { res, data } = await createMockViaAPI(app, {
      name: 'Test API',
      sample: SAMPLE_DATA,
      amplify: false,
    });

    expect(res.status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.name).toBe('Test API');
    expect(data.resources).toHaveLength(3);
    expect(data.resources.map((r: any) => r.name).sort()).toEqual(['comments', 'posts', 'users']);

    mockId = data.id;
  });

  it('infers fields correctly from sample data', async () => {
    const res = await app.request(`/api/mocks/${mockId}`);
    const data = await res.json() as any;

    const users = data.resources.find((r: any) => r.name === 'users');
    expect(users.fields.map((f: any) => f.name)).toContain('name');
    expect(users.fields.map((f: any) => f.name)).toContain('email');
    expect(users.fields.map((f: any) => f.name)).toContain('age');
  });

  it('lists mocks', async () => {
    const res = await app.request('/api/mocks');
    const data = await res.json() as any[];

    expect(res.status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.find((m: any) => m.id === mockId)).toBeDefined();
  });

  it('returns seed data via dynamic route', async () => {
    const res = await app.request(`/m/${mockId}/users`);
    const data = await res.json() as any[];

    expect(res.status).toBe(200);
    expect(data).toHaveLength(3);
    expect(data[0].name).toBe('Alex Johnson');
  });

  it('supports stateful CRUD — POST then GET', async () => {
    // POST new user
    const postRes = await app.request(`/m/${mockId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 4, name: 'New User', email: 'new@test.com' }),
    });
    expect(postRes.status).toBe(201);

    // GET should include new user
    const getRes = await app.request(`/m/${mockId}/users`);
    const users = await getRes.json() as any[];
    expect(users).toHaveLength(4);
    expect(users.find((u: any) => u.name === 'New User')).toBeDefined();
  });

  it('supports DELETE then GET', async () => {
    const delRes = await app.request(`/m/${mockId}/users/4`, { method: 'DELETE' });
    expect(delRes.status).toBe(200);

    const getRes = await app.request(`/m/${mockId}/users`);
    const users = await getRes.json() as any[];
    expect(users).toHaveLength(3);
  });

  it('resets data to original seed', async () => {
    // Add extra data
    await app.request(`/m/${mockId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 99, name: 'Temp' }),
    });

    // Reset
    const resetRes = await app.request(`/api/mocks/${mockId}/reset`, { method: 'POST' });
    expect(resetRes.status).toBe(200);

    // Verify back to original
    const getRes = await app.request(`/m/${mockId}/users`);
    const users = await getRes.json() as any[];
    expect(users).toHaveLength(3);
    expect(users.find((u: any) => u.name === 'Temp')).toBeUndefined();
  });

  it('deletes a mock', async () => {
    const { data: newMock } = await createMockViaAPI(app, {
      name: 'To Delete',
      sample: { items: [{ id: 1, value: 'test' }] },
      amplify: false,
    });

    const delRes = await app.request(`/api/mocks/${newMock.id}`, { method: 'DELETE' });
    expect(delRes.status).toBe(200);

    const getRes = await app.request(`/api/mocks/${newMock.id}`);
    expect(getRes.status).toBe(404);
  });
});
