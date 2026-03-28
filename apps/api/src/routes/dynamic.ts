import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { getAllRows, getRowById, insertRow, updateRow, deleteRow } from '../db/mock-tables.js';
import type { ResourceConfig } from '@mocksnap/shared';

const dynamic = new Hono();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Middleware: validate mock/resource + apply response config (delay, errors)
async function validateAndApplyConfig(c: Parameters<Parameters<typeof dynamic.use>[1]>[0], next: () => Promise<void>) {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');

  const mock = db.prepare('SELECT id FROM mocks WHERE id = ?').get(mockId);
  if (!mock) {
    return c.json({ error: 'Not Found', message: 'Mock not found' }, 404);
  }

  const res = db.prepare('SELECT name, config_json FROM mock_resources WHERE mock_id = ? AND name = ?').get(mockId, resource) as
    | { name: string; config_json: string }
    | undefined;
  if (!res) {
    return c.json({ error: 'Not Found', message: `Resource "${resource}" not found in this mock` }, 404);
  }

  const config: ResourceConfig = JSON.parse(res.config_json || '{}');

  // Apply delay
  if (config.delay && config.delay > 0) {
    await sleep(config.delay);
  }

  // Apply forced status code
  if (config.forceStatus) {
    return c.json({ error: 'Simulated Error', message: `Forced status ${config.forceStatus}` }, config.forceStatus as 400);
  }

  // Apply random error rate
  if (config.errorRate && config.errorRate > 0 && Math.random() < config.errorRate) {
    const status = config.errorStatus || 500;
    return c.json({ error: 'Simulated Error', message: `Random error (${Math.round(config.errorRate * 100)}% rate)` }, status as 500);
  }

  await next();
}

dynamic.use('/:mockId/:resource/*', validateAndApplyConfig);
dynamic.use('/:mockId/:resource', validateAndApplyConfig);

// GET /m/:mockId/:resource — list all
dynamic.get('/:mockId/:resource', (c) => {
  const rows = getAllRows(c.req.param('mockId'), c.req.param('resource'));
  return c.json(rows);
});

// GET /m/:mockId/:resource/:id — get one
dynamic.get('/:mockId/:resource/:id', (c) => {
  const row = getRowById(c.req.param('mockId'), c.req.param('resource'), c.req.param('id'));
  if (!row) {
    return c.json({ error: 'Not Found', message: 'Item not found' }, 404);
  }
  return c.json(row);
});

// POST /m/:mockId/:resource — create
dynamic.post('/:mockId/:resource', async (c) => {
  const body = await c.req.json();
  const result = insertRow(c.req.param('mockId'), c.req.param('resource'), body);
  return c.json(result.data, 201);
});

// PUT /m/:mockId/:resource/:id — full replace
dynamic.put('/:mockId/:resource/:id', async (c) => {
  const body = await c.req.json();
  const updated = updateRow(c.req.param('mockId'), c.req.param('resource'), c.req.param('id'), body, false);
  if (!updated) {
    return c.json({ error: 'Not Found', message: 'Item not found' }, 404);
  }
  return c.json(updated);
});

// PATCH /m/:mockId/:resource/:id — partial update
dynamic.patch('/:mockId/:resource/:id', async (c) => {
  const body = await c.req.json();
  const updated = updateRow(c.req.param('mockId'), c.req.param('resource'), c.req.param('id'), body, true);
  if (!updated) {
    return c.json({ error: 'Not Found', message: 'Item not found' }, 404);
  }
  return c.json(updated);
});

// DELETE /m/:mockId/:resource/:id — delete
dynamic.delete('/:mockId/:resource/:id', (c) => {
  const deleted = deleteRow(c.req.param('mockId'), c.req.param('resource'), c.req.param('id'));
  if (!deleted) {
    return c.json({ error: 'Not Found', message: 'Item not found' }, 404);
  }
  return c.json({ message: 'Deleted' });
});

export { dynamic };
