import { Hono } from 'hono';
import { createMock, getMock, deleteMock } from '../services/mock-service.js';
import type { CreateMockRequest } from '@mocksnap/shared';

const mocks = new Hono();

mocks.post('/', async (c) => {
  const body = await c.req.json<CreateMockRequest>();

  if (!body.sample || typeof body.sample !== 'object') {
    return c.json({ error: 'Bad Request', message: '"sample" field is required and must be an object or array' }, 400);
  }

  const mock = createMock(body);
  return c.json(mock, 201);
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
