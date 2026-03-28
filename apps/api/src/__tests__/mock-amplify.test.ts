import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp, createMockViaAPI, SAMPLE_DATA } from './setup.js';
import type { Hono } from 'hono';

let app: Hono;
let mockId: string;

beforeAll(async () => {
  app = createTestApp();
  const { data } = await createMockViaAPI(app, {
    name: 'Amplify Test',
    sample: SAMPLE_DATA,
    amplify: false,
  });
  mockId = data.id;
});

describe('Data Amplification', () => {
  it('amplifies a specific resource', async () => {
    const res = await app.request(`/api/mocks/${mockId}/amplify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'users', count: 10 }),
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].resource).toBe('users');
    expect(data.results[0].added).toBe(10);
    expect(data.results[0].total).toBe(13); // 3 original + 10 new
  });

  it('preserves existing data after amplification', async () => {
    const res = await app.request(`/m/${mockId}/users`);
    const users = await res.json() as any[];

    expect(users).toHaveLength(13);
    // Original data still present
    expect(users.find((u: any) => u.name === 'Alex Johnson')).toBeDefined();
    expect(users.find((u: any) => u.name === 'Sarah Miller')).toBeDefined();
  });

  it('generates realistic field values', async () => {
    const res = await app.request(`/m/${mockId}/users`);
    const users = await res.json() as any[];

    // Check Faker-generated items (id > 3 are amplified)
    const amplified = users.filter((u: any) => u.id > 3);
    expect(amplified.length).toBeGreaterThanOrEqual(1);

    for (const user of amplified) {
      // email should contain @
      expect(user.email).toContain('@');
      // age should be a number
      expect(typeof user.age).toBe('number');
      // name should be a non-empty string
      expect(typeof user.name).toBe('string');
      expect(user.name.length).toBeGreaterThan(0);
    }
  });

  it('amplifies all resources at once', async () => {
    const res = await app.request(`/api/mocks/${mockId}/amplify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 5 }),
    });
    const data = await res.json() as any;

    expect(data.results.length).toBe(3); // users, posts, comments
    for (const r of data.results) {
      expect(r.added).toBe(5);
    }
  });

  it('returns error for non-existent resource', async () => {
    const res = await app.request(`/api/mocks/${mockId}/amplify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'nonexistent', count: 5 }),
    });

    expect(res.status).toBe(400);
  });

  it('caps amplification at 1000', async () => {
    const { data: newMock } = await createMockViaAPI(app, {
      name: 'Cap Test',
      sample: { items: [{ id: 1, value: 'test' }] },
      amplify: false,
    });

    const res = await app.request(`/api/mocks/${newMock.id}/amplify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 5000 }), // Over cap
    });
    const data = await res.json() as any;

    // Should be capped at 1000
    expect(data.results[0].added).toBe(1000);
  });
});
