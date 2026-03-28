import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Set test DB path before any imports
const testDbPath = `/tmp/mocksnap-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
process.env.DATABASE_PATH = testDbPath;

// Now import after env is set
import { initializeSchema } from '../db/schema.js';
import { mocks } from '../routes/mocks.js';
import { config } from '../routes/config.js';
import { graphql } from '../routes/graphql.js';
import { docs } from '../routes/docs.js';
import { dynamic } from '../routes/dynamic.js';

export function createTestApp() {
  initializeSchema();

  const app = new Hono();
  app.use('*', cors());
  app.route('/api/mocks', mocks);
  app.route('/api/mocks', config);
  app.route('/m', docs);
  app.route('/m', graphql);
  app.route('/m', dynamic);
  app.get('/health', (c) => c.json({ status: 'ok' }));

  return app;
}

export async function createMockViaAPI(app: Hono, body: Record<string, unknown>) {
  const res = await app.request('/api/mocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { res, data: await res.json() };
}

export const SAMPLE_DATA = {
  users: [
    { id: 1, name: 'Alex Johnson', email: 'alex@example.com', age: 28 },
    { id: 2, name: 'Sarah Miller', email: 'sarah@example.com', age: 32 },
    { id: 3, name: 'James Wilson', email: 'james@example.com', age: 25 },
  ],
  posts: [
    { id: 1, title: 'First Post', body: 'Hello world', userId: 1 },
    { id: 2, title: 'Second Post', body: 'Another post', userId: 2 },
  ],
  comments: [
    { id: 1, body: 'Nice post!', postId: 1, userId: 2 },
    { id: 2, body: 'Thanks!', postId: 1, userId: 1 },
  ],
};
