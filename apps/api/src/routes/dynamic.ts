import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { getAllRows, getRowById, insertRow, updateRow, deleteRow } from '../db/mock-tables.js';
import type { ResourceConfig } from '@mocksnap/shared';

const dynamic = new Hono();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logRequest(mockId: string, method: string, path: string, status: number, requestBody?: string, responseBody?: string) {
  db.prepare(
    'INSERT INTO request_logs (mock_id, method, path, status, request_body, response_body) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(mockId, method, path, status, requestBody ?? null, responseBody ?? null);
}

function fireWebhook(webhookUrl: string, event: string, resource: string, data: unknown) {
  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, resource, data, timestamp: new Date().toISOString() }),
  }).catch(() => {/* ignore webhook failures */});
}

function getResourceConfig(mockId: string, resource: string): ResourceConfig | null {
  const res = db.prepare('SELECT config_json FROM mock_resources WHERE mock_id = ? AND name = ?').get(mockId, resource) as
    | { config_json: string }
    | undefined;
  return res ? JSON.parse(res.config_json || '{}') : null;
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
    const body = { error: 'Simulated Error', message: `Forced status ${config.forceStatus}` };
    logRequest(mockId, c.req.method, c.req.path, config.forceStatus);
    return c.json(body, config.forceStatus as 400);
  }

  // Apply random error rate
  if (config.errorRate && config.errorRate > 0 && Math.random() < config.errorRate) {
    const status = config.errorStatus || 500;
    const body = { error: 'Simulated Error', message: `Random error (${Math.round(config.errorRate * 100)}% rate)` };
    logRequest(mockId, c.req.method, c.req.path, status);
    return c.json(body, status as 500);
  }

  await next();
}

dynamic.use('/:mockId/:resource/*', validateAndApplyConfig);
dynamic.use('/:mockId/:resource', validateAndApplyConfig);

// GET /m/:mockId/:resource — list all
dynamic.get('/:mockId/:resource', (c) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');
  const rows = getAllRows(mockId, resource);
  const body = JSON.stringify(rows);
  logRequest(mockId, 'GET', c.req.path, 200, undefined, body);
  return c.json(rows);
});

// GET /m/:mockId/:resource/:id — get one
dynamic.get('/:mockId/:resource/:id', (c) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');
  const row = getRowById(mockId, resource, c.req.param('id'));
  if (!row) {
    logRequest(mockId, 'GET', c.req.path, 404);
    return c.json({ error: 'Not Found', message: 'Item not found' }, 404);
  }
  logRequest(mockId, 'GET', c.req.path, 200, undefined, JSON.stringify(row));
  return c.json(row);
});

// POST /m/:mockId/:resource — create
dynamic.post('/:mockId/:resource', async (c) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');
  const body = await c.req.json();
  const result = insertRow(mockId, resource, body);
  logRequest(mockId, 'POST', c.req.path, 201, JSON.stringify(body), JSON.stringify(result.data));

  const config = getResourceConfig(mockId, resource);
  if (config?.webhookUrl) {
    fireWebhook(config.webhookUrl, 'created', resource, result.data);
  }

  return c.json(result.data, 201);
});

// PUT /m/:mockId/:resource/:id — full replace
dynamic.put('/:mockId/:resource/:id', async (c) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');
  const body = await c.req.json();
  const updated = updateRow(mockId, resource, c.req.param('id'), body, false);
  if (!updated) {
    logRequest(mockId, 'PUT', c.req.path, 404, JSON.stringify(body));
    return c.json({ error: 'Not Found', message: 'Item not found' }, 404);
  }
  logRequest(mockId, 'PUT', c.req.path, 200, JSON.stringify(body), JSON.stringify(updated));

  const config = getResourceConfig(mockId, resource);
  if (config?.webhookUrl) {
    fireWebhook(config.webhookUrl, 'updated', resource, updated);
  }

  return c.json(updated);
});

// PATCH /m/:mockId/:resource/:id — partial update
dynamic.patch('/:mockId/:resource/:id', async (c) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');
  const body = await c.req.json();
  const updated = updateRow(mockId, resource, c.req.param('id'), body, true);
  if (!updated) {
    logRequest(mockId, 'PATCH', c.req.path, 404, JSON.stringify(body));
    return c.json({ error: 'Not Found', message: 'Item not found' }, 404);
  }
  logRequest(mockId, 'PATCH', c.req.path, 200, JSON.stringify(body), JSON.stringify(updated));

  const config = getResourceConfig(mockId, resource);
  if (config?.webhookUrl) {
    fireWebhook(config.webhookUrl, 'updated', resource, updated);
  }

  return c.json(updated);
});

// DELETE /m/:mockId/:resource/:id — delete
dynamic.delete('/:mockId/:resource/:id', (c) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');
  const id = c.req.param('id');

  // Get item before deletion for webhook
  const item = getRowById(mockId, resource, id);
  const deleted = deleteRow(mockId, resource, id);
  if (!deleted) {
    logRequest(mockId, 'DELETE', c.req.path, 404);
    return c.json({ error: 'Not Found', message: 'Item not found' }, 404);
  }
  logRequest(mockId, 'DELETE', c.req.path, 200);

  const config = getResourceConfig(mockId, resource);
  if (config?.webhookUrl) {
    fireWebhook(config.webhookUrl, 'deleted', resource, item);
  }

  return c.json({ message: 'Deleted' });
});

export { dynamic };
