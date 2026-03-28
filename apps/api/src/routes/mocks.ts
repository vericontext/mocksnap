import { Hono } from 'hono';
import { createMock, getMock, deleteMock, listMocks } from '../services/mock-service.js';
import { db } from '../db/connection.js';
import type { CreateMockRequest } from '@mocksnap/shared';

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

  if (body.prompt && !process.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'Service Unavailable', message: 'AI features require ANTHROPIC_API_KEY to be configured' }, 503);
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
