import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { getAllRows, getRowById, insertRow, updateRow, deleteRow, queryRows } from '../db/mock-tables.js';
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

function singularize(s: string): string {
  if (s.endsWith('ies')) return s.slice(0, -3) + 'y';
  if (s.endsWith('ses') || s.endsWith('xes') || s.endsWith('zes')) return s.slice(0, -2);
  if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1);
  return s;
}

function getResourceNames(mockId: string): string[] {
  const rows = db.prepare('SELECT name FROM mock_resources WHERE mock_id = ?').all(mockId) as { name: string }[];
  return rows.map((r) => r.name);
}

function findForeignKeyField(mockId: string, childResource: string, parentResource: string): string | null {
  const singular = singularize(parentResource);
  const candidates = [`${singular}Id`, `${singular}_id`, `${singular}id`];

  // Get a sample row to check which field exists
  const rows = getAllRows(mockId, childResource);
  if (rows.length === 0) return candidates[0]; // Default guess

  const sampleKeys = Object.keys(rows[0] as Record<string, unknown>);
  for (const candidate of candidates) {
    if (sampleKeys.includes(candidate)) return candidate;
  }
  return null;
}

function expandRelations(mockId: string, rows: unknown[], expandFields: string[]): unknown[] {
  const resources = getResourceNames(mockId);

  return rows.map((row) => {
    const obj = { ...(row as Record<string, unknown>) };
    for (const field of expandFields) {
      // field = "user" → look for "userId" in data, fetch from "users" resource
      const fkField = `${field}Id`;
      const fkFieldSnake = `${field}_id`;
      const fkValue = obj[fkField] ?? obj[fkFieldSnake];
      const targetResource = field.endsWith('s') ? field : field + 's';

      if (fkValue !== undefined && resources.includes(targetResource)) {
        const related = getRowById(mockId, targetResource, String(fkValue));
        if (related) obj[field] = related;
      }
    }
    return obj;
  });
}

function embedRelations(mockId: string, rows: unknown[], resourceName: string, embedFields: string[]): unknown[] {
  const resources = getResourceNames(mockId);

  return rows.map((row) => {
    const obj = { ...(row as Record<string, unknown>) };
    const id = obj.id;

    for (const embedResource of embedFields) {
      if (!resources.includes(embedResource)) continue;
      const fkField = findForeignKeyField(mockId, embedResource, resourceName);
      if (!fkField || id === undefined) continue;

      const allChildren = getAllRows(mockId, embedResource);
      obj[embedResource] = allChildren.filter((child) => {
        const childObj = child as Record<string, unknown>;
        return String(childObj[fkField]) === String(id);
      });
    }
    return obj;
  });
}

const RESERVED_PARAMS = new Set(['sort', 'order', 'page', 'limit', 'q', '_expand', '_embed']);

function parseQueryOptions(query: Record<string, string>) {
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!RESERVED_PARAMS.has(key)) {
      filters[key] = value;
    }
  }

  return {
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    sort: query.sort,
    order: (query.order === 'desc' ? 'desc' : query.order === 'asc' ? 'asc' : undefined) as 'asc' | 'desc' | undefined,
    page: query.page ? Number(query.page) : undefined,
    limit: query.limit ? Number(query.limit) : undefined,
    q: query.q,
    _expand: query._expand ? query._expand.split(',') : undefined,
    _embed: query._embed ? query._embed.split(',') : undefined,
  };
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

  if (config.delay && config.delay > 0) {
    await sleep(config.delay);
  }

  if (config.forceStatus) {
    const body = { error: 'Simulated Error', message: `Forced status ${config.forceStatus}` };
    logRequest(mockId, c.req.method, c.req.path, config.forceStatus);
    return c.json(body, config.forceStatus as 400);
  }

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

// GET /m/:mockId/:resource — list with filtering, sorting, pagination, search
dynamic.get('/:mockId/:resource', (c) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');
  const opts = parseQueryOptions(c.req.query());

  const { data, total } = queryRows(mockId, resource, opts);

  let result = data;
  if (opts._expand) result = expandRelations(mockId, result, opts._expand);
  if (opts._embed) result = embedRelations(mockId, result, resource, opts._embed);

  const body = JSON.stringify(result);
  logRequest(mockId, 'GET', c.req.path, 200, undefined, body);

  c.header('X-Total-Count', String(total));
  c.header('Access-Control-Expose-Headers', 'X-Total-Count');
  return c.json(result);
});

// GET /m/:mockId/:resource/:id — get one with _expand/_embed
dynamic.get('/:mockId/:resource/:id', (c) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');
  const id = c.req.param('id');

  // Check if :id is actually a sub-resource (nested route: /users/1/posts)
  // This is handled by the next route below

  const row = getRowById(mockId, resource, id);
  if (!row) {
    logRequest(mockId, 'GET', c.req.path, 404);
    return c.json({ error: 'Not Found', message: 'Item not found' }, 404);
  }

  const query = c.req.query();
  let result = [row];
  if (query._expand) result = expandRelations(mockId, result, query._expand.split(','));
  if (query._embed) result = embedRelations(mockId, result, resource, query._embed.split(','));

  const body = JSON.stringify(result[0]);
  logRequest(mockId, 'GET', c.req.path, 200, undefined, body);
  return c.json(result[0]);
});

// GET /m/:mockId/:resource/:id/:subResource — nested resources
dynamic.get('/:mockId/:resource/:id/:subResource', (c) => {
  const mockId = c.req.param('mockId');
  const parentResource = c.req.param('resource');
  const parentId = c.req.param('id');
  const subResource = c.req.param('subResource');

  // Verify parent exists
  const parent = getRowById(mockId, parentResource, parentId);
  if (!parent) {
    return c.json({ error: 'Not Found', message: `${singularize(parentResource)} not found` }, 404);
  }

  // Verify sub-resource exists
  const resources = getResourceNames(mockId);
  if (!resources.includes(subResource)) {
    return c.json({ error: 'Not Found', message: `Resource "${subResource}" not found` }, 404);
  }

  // Find FK field in sub-resource
  const fkField = findForeignKeyField(mockId, subResource, parentResource);
  if (!fkField) {
    return c.json({ error: 'Bad Request', message: `No foreign key found linking ${subResource} to ${parentResource}` }, 400);
  }

  // Query sub-resource with FK filter + any additional query params
  const opts = parseQueryOptions(c.req.query());
  opts.filters = { ...opts.filters, [fkField]: parentId };

  const { data, total } = queryRows(mockId, subResource, opts);

  let result = data;
  if (opts._expand) result = expandRelations(mockId, result, opts._expand);

  logRequest(mockId, 'GET', c.req.path, 200, undefined, JSON.stringify(result));

  c.header('X-Total-Count', String(total));
  c.header('Access-Control-Expose-Headers', 'X-Total-Count');
  return c.json(result);
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
