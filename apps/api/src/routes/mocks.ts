import { Hono } from 'hono';
import { createMock, getMock, deleteMock } from '../services/mock-service.js';
import type { CreateMockRequest } from '@mocksnap/shared';

const mocks = new Hono();

mocks.post('/', async (c) => {
  const body = await c.req.json<CreateMockRequest>();

  if (!body.sample && !body.prompt) {
    return c.json({ error: 'Bad Request', message: 'Either "sample" or "prompt" is required' }, 400);
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

mocks.delete('/:mockId', (c) => {
  const deleted = deleteMock(c.req.param('mockId'));
  if (!deleted) {
    return c.json({ error: 'Not Found', message: 'Mock not found' }, 404);
  }
  return c.json({ message: 'Mock deleted' });
});

export { mocks };
