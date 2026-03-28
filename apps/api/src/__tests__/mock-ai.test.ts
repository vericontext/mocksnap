import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp, createMockViaAPI } from './setup.js';
import type { Hono } from 'hono';

const HAS_AI_KEY = !!(process.env.ANTHROPIC_API_KEY);
const describeAI = HAS_AI_KEY ? describe : describe.skip;

let app: Hono;

beforeAll(() => {
  app = createTestApp();
});

describeAI('AI Features (requires ANTHROPIC_API_KEY)', () => {
  let mockId: string;

  it('creates mock from natural language prompt', async () => {
    const { res, data } = await createMockViaAPI(app, {
      name: 'NL Test',
      prompt: 'Simple blog API with users and posts. Users have name and email. Posts have title and userId. 3 items each.',
    });

    expect(res.status).toBe(201);
    expect(data.resources.length).toBeGreaterThanOrEqual(2);

    const resourceNames = data.resources.map((r: any) => r.name);
    expect(resourceNames).toContain('users');
    expect(resourceNames).toContain('posts');

    mockId = data.id;
  });

  it('natural language data has realistic values', async () => {
    const res = await app.request(`/m/${mockId}/users`);
    const users = await res.json() as any[];

    expect(users.length).toBeGreaterThanOrEqual(1);
    expect(users[0].id).toBeDefined();
    expect(users[0].name).toBeDefined();
    expect(typeof users[0].name).toBe('string');
    expect(users[0].name.length).toBeGreaterThan(0);
  });

  it('chat modification adds field to existing resource', async () => {
    const res = await app.request(`/api/mocks/${mockId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Add an age field to users' }),
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.changes.length).toBeGreaterThanOrEqual(1);

    // Verify field was added
    const getRes = await app.request(`/m/${mockId}/users`);
    const users = await getRes.json() as any[];
    const fields = Object.keys(users[0]);
    expect(fields).toContain('age');
  });

  it('chat modification adds new resource', async () => {
    const res = await app.request(`/api/mocks/${mockId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Add a comments resource with body and postId fields' }),
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.mock.resources.map((r: any) => r.name)).toContain('comments');

    // Verify resource has data
    const getRes = await app.request(`/m/${mockId}/comments`);
    const comments = await getRes.json() as any[];
    expect(comments.length).toBeGreaterThanOrEqual(1);
  });

  it('chat modification preserves existing resources', async () => {
    const beforeRes = await app.request(`/api/mocks/${mockId}`);
    const beforeData = await beforeRes.json() as any;
    const beforeResourceNames = beforeData.resources.map((r: any) => r.name).sort();

    // Modify something minor
    await app.request(`/api/mocks/${mockId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Add a bio field to users' }),
    });

    const afterRes = await app.request(`/api/mocks/${mockId}`);
    const afterData = await afterRes.json() as any;
    const afterResourceNames = afterData.resources.map((r: any) => r.name).sort();

    // All original resources should still exist
    for (const name of beforeResourceNames) {
      expect(afterResourceNames).toContain(name);
    }
  });
});

describe('AI Features - Error Handling', () => {
  it('returns error when prompt used without API key', async () => {
    const appNoKey = createTestApp();
    const origKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const res = await appNoKey.request('/api/mocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'User API' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.message).toContain('API key');

    if (origKey) process.env.ANTHROPIC_API_KEY = origKey;
  });
});
