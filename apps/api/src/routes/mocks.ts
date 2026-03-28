import { Hono } from 'hono';
import { createMock, getMock, deleteMock, listMocks, modifyMockWithChat } from '../services/mock-service.js';
import { db } from '../db/connection.js';
import { resetTable } from '../db/mock-tables.js';
import type { CreateMockRequest, ModifyMockRequest } from '@mocksnap/shared';

const mocks = new Hono();

// GET /api/mocks — list all mocks
mocks.get('/', (c) => {
  return c.json(listMocks());
});

mocks.post('/', async (c) => {
  const body = await c.req.json<CreateMockRequest>();

  if (!body.sample && !body.prompt && !body.openapi) {
    return c.json({ error: 'Bad Request', message: 'Either "sample", "prompt", or "openapi" is required' }, 400);
  }

  if (body.sample && typeof body.sample !== 'object') {
    return c.json({ error: 'Bad Request', message: '"sample" must be an object or array' }, 400);
  }

  const needsAI = !!(body.prompt || body.openapi);
  const hasAI = !!(body.anthropicApiKey || process.env.ANTHROPIC_API_KEY);
  if (needsAI && !hasAI) {
    return c.json({ error: 'API Key Required', message: 'AI features require an Anthropic API key. Please provide your key.' }, 400);
  }

  try {
    const mock = await createMock(body);
    return c.json(mock, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create mock';
    return c.json({ error: 'Internal Error', message }, 500);
  }
});

mocks.get('/:mockId', (c) => {
  const mock = getMock(c.req.param('mockId'));
  if (!mock) {
    return c.json({ error: 'Not Found', message: 'Mock not found' }, 404);
  }
  return c.json(mock);
});

// POST /api/mocks/:mockId/chat — modify mock via natural language
mocks.post('/:mockId/chat', async (c) => {
  const mockId = c.req.param('mockId');
  const body = await c.req.json<ModifyMockRequest>();

  if (!body.message) {
    return c.json({ error: 'Bad Request', message: '"message" is required' }, 400);
  }

  const hasAI = !!(body.anthropicApiKey || process.env.ANTHROPIC_API_KEY);
  if (!hasAI) {
    return c.json({ error: 'API Key Required', message: 'Modifying a mock requires an Anthropic API key.' }, 400);
  }

  try {
    const { changes, mock } = await modifyMockWithChat(mockId, body.message, body.anthropicApiKey);
    return c.json({ message: `Applied ${changes.length} change(s)`, changes, mock });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to modify mock';
    return c.json({ error: 'Internal Error', message }, 500);
  }
});

// POST /api/mocks/:mockId/reset — restore seed data
mocks.post('/:mockId/reset', (c) => {
  const mockId = c.req.param('mockId');
  const resources = db.prepare('SELECT name, seed_data FROM mock_resources WHERE mock_id = ?').all(mockId) as {
    name: string; seed_data: string;
  }[];

  if (resources.length === 0) {
    return c.json({ error: 'Not Found', message: 'Mock not found' }, 404);
  }

  for (const r of resources) {
    const seedData = JSON.parse(r.seed_data || '[]');
    resetTable(mockId, r.name, seedData);
  }

  return c.json({ message: 'Mock data reset to initial state', resources: resources.length });
});

// GET /api/mocks/:mockId/logs — request logs
mocks.get('/:mockId/logs', (c) => {
  const mockId = c.req.param('mockId');
  const logs = db.prepare(
    'SELECT id, mock_id, method, path, status, request_body, response_body, created_at FROM request_logs WHERE mock_id = ? ORDER BY created_at DESC LIMIT 100'
  ).all(mockId) as {
    id: number; mock_id: string; method: string; path: string; status: number;
    request_body: string | null; response_body: string | null; created_at: string;
  }[];

  return c.json(logs.map((l) => ({
    id: l.id,
    mockId: l.mock_id,
    method: l.method,
    path: l.path,
    status: l.status,
    requestBody: l.request_body,
    responseBody: l.response_body,
    createdAt: l.created_at,
  })));
});

mocks.delete('/:mockId', (c) => {
  const deleted = deleteMock(c.req.param('mockId'));
  if (!deleted) {
    return c.json({ error: 'Not Found', message: 'Mock not found' }, 404);
  }
  return c.json({ message: 'Mock deleted' });
});

export { mocks };
