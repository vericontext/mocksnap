import { Hono } from 'hono';
import type { Context } from 'hono';
import { createHash, createHmac } from 'node:crypto';
import { db } from '../db/connection.js';
import { getAllRows, getRowById, insertRow, updateRow, deleteRow, queryRows } from '../db/mock-tables.js';
import type { ResourceConfig, DelayConfig } from '@mocksnap/shared';

const dynamic = new Hono();

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelay(delay: number | DelayConfig): number {
  if (typeof delay === 'number') return delay;
  if (delay.type === 'uniform') {
    const min = delay.min ?? 0;
    const max = delay.max ?? 1000;
    return min + Math.random() * (max - min);
  }
  if (delay.type === 'normal') {
    const mean = delay.mean ?? 200;
    const sigma = delay.sigma ?? 50;
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, mean + z * sigma);
  }
  return 0;
}

function logRequest(mockId: string, method: string, path: string, status: number, requestBody?: string, responseBody?: string) {
  db.prepare(
    'INSERT INTO request_logs (mock_id, method, path, status, request_body, response_body) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(mockId, method, path, status, requestBody ?? null, responseBody ?? null);
}

function fireWebhook(webhookUrl: string, event: string, resource: string, data: unknown, secret?: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ event, resource, data, timestamp: new Date().toISOString() });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (secret) {
    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    headers['X-MockSnap-Signature'] = `sha256=${signature}`;
    headers['X-MockSnap-Timestamp'] = String(timestamp);
  }

  fetch(webhookUrl, { method: 'POST', headers, body }).catch(() => {});
}

function getResourceConfig(mockId: string, resource: string): ResourceConfig | null {
  const res = db.prepare('SELECT config_json FROM mock_resources WHERE mock_id = ? AND name = ?').get(mockId, resource) as
    | { config_json: string }
    | undefined;
  return res ? JSON.parse(res.config_json || '{}') : null;
}

// --- ETag ---

function generateETag(body: string): string {
  return `"${createHash('md5').update(body).digest('hex')}"`;
}

function checkConditional(c: Context, body: string): Response | null {
  const etag = generateETag(body);
  c.header('ETag', etag);

  const ifNoneMatch = c.req.header('If-None-Match');
  if (ifNoneMatch && ifNoneMatch === etag) {
    return c.body(null, 304);
  }
  return null;
}

// --- RFC 7807 Problem Details ---

const STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 429: 'Too Many Requests',
  500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
};

function problemJson(c: Context, status: number, detail: string) {
  return c.json({
    type: `https://httpstatuses.com/${status}`,
    title: STATUS_TITLES[status] || 'Error',
    status,
    detail,
    instance: c.req.path,
  }, status as 400);
}

// --- Field Selection ---

function selectFields(rows: unknown[], fields?: string[]): unknown[] {
  if (!fields || fields.length === 0) return rows;
  return rows.map((row) => {
    const obj = row as Record<string, unknown>;
    const selected: Record<string, unknown> = {};
    for (const f of fields) {
      if (f in obj) selected[f] = obj[f];
    }
    return selected;
  });
}

// --- Rate Limit Headers ---

const rateLimitCounters = new Map<string, { remaining: number; resetAt: number }>();

function applyRateLimitHeaders(c: Context, mockId: string, resource: string, limit: number) {
  const key = `${mockId}:${resource}`;
  const now = Math.floor(Date.now() / 1000);
  let entry = rateLimitCounters.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { remaining: limit - 1, resetAt: now + 3600 };
    rateLimitCounters.set(key, entry);
  } else {
    entry.remaining = Math.max(0, entry.remaining - 1);
  }

  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(entry.remaining));
  c.header('X-RateLimit-Reset', String(entry.resetAt));
}

// --- Link Header (Pagination) ---

function buildLinkHeader(basePath: string, query: Record<string, string>, page: number, limit: number, total: number): string {
  const totalPages = Math.ceil(total / limit);
  const links: string[] = [];

  const buildUrl = (p: number) => {
    const params = new URLSearchParams({ ...query, page: String(p), limit: String(limit) });
    return `<${basePath}?${params}>`;
  };

  if (page < totalPages) links.push(`${buildUrl(page + 1)}; rel="next"`);
  if (page > 1) links.push(`${buildUrl(page - 1)}; rel="prev"`);
  links.push(`${buildUrl(1)}; rel="first"`);
  links.push(`${buildUrl(totalPages)}; rel="last"`);

  return links.join(', ');
}

// --- Relation Helpers ---

function singularize(s: string): string {
  if (s.endsWith('ies')) return s.slice(0, -3) + 'y';
  if (s.endsWith('ses') || s.endsWith('xes') || s.endsWith('zes')) return s.slice(0, -2);
  if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1);
  return s;
}

function getResourceNames(mockId: string): string[] {
  return (db.prepare('SELECT name FROM mock_resources WHERE mock_id = ?').all(mockId) as { name: string }[]).map((r) => r.name);
}

function findForeignKeyField(mockId: string, childResource: string, parentResource: string): string | null {
  const singular = singularize(parentResource);
  const candidates = [`${singular}Id`, `${singular}_id`, `${singular}id`];
  const rows = getAllRows(mockId, childResource);
  if (rows.length === 0) return candidates[0];
  const sampleKeys = Object.keys(rows[0] as Record<string, unknown>);
  for (const candidate of candidates) {
    if (sampleKeys.includes(candidate)) return candidate;
  }
  return null;
}

const MAX_RELATION_DEPTH = 3;

function parseNestedFields(fields: string[]): Map<string, string[]> {
  // ["user", "user.posts", "user.posts.comments"] →
  // Map { "user" => ["posts", "posts.comments"] }
  const topLevel = new Map<string, string[]>();
  for (const field of fields) {
    const dotIdx = field.indexOf('.');
    if (dotIdx === -1) {
      if (!topLevel.has(field)) topLevel.set(field, []);
    } else {
      const top = field.slice(0, dotIdx);
      const rest = field.slice(dotIdx + 1);
      if (!topLevel.has(top)) topLevel.set(top, []);
      topLevel.get(top)!.push(rest);
    }
  }
  return topLevel;
}

function expandRelations(mockId: string, rows: unknown[], expandFields: string[], depth: number = 0): unknown[] {
  if (depth >= MAX_RELATION_DEPTH) return rows;
  const resources = getResourceNames(mockId);
  const nested = parseNestedFields(expandFields);

  return rows.map((row) => {
    const obj = { ...(row as Record<string, unknown>) };
    for (const [field, subFields] of nested) {
      const fkValue = obj[`${field}Id`] ?? obj[`${field}_id`];
      const targetResource = field.endsWith('s') ? field : field + 's';
      if (fkValue !== undefined && resources.includes(targetResource)) {
        let related = getRowById(mockId, targetResource, String(fkValue));
        if (related && subFields.length > 0) {
          [related] = expandRelations(mockId, [related], subFields, depth + 1);
          [related] = embedRelations(mockId, [related], targetResource, subFields, depth + 1);
        }
        if (related) obj[field] = related;
      }
    }
    return obj;
  });
}

function embedRelations(mockId: string, rows: unknown[], resourceName: string, embedFields: string[], depth: number = 0): unknown[] {
  if (depth >= MAX_RELATION_DEPTH) return rows;
  const resources = getResourceNames(mockId);
  const nested = parseNestedFields(embedFields);

  return rows.map((row) => {
    const obj = { ...(row as Record<string, unknown>) };
    const id = obj.id;
    for (const [embedResource, subFields] of nested) {
      if (!resources.includes(embedResource)) continue;
      const fkField = findForeignKeyField(mockId, embedResource, resourceName);
      if (!fkField || id === undefined) continue;
      const allChildren = getAllRows(mockId, embedResource);
      let matched = allChildren.filter((child) =>
        String((child as Record<string, unknown>)[fkField]) === String(id)
      );
      if (subFields.length > 0) {
        matched = embedRelations(mockId, matched, embedResource, subFields, depth + 1);
        matched = expandRelations(mockId, matched, subFields, depth + 1);
      }
      obj[embedResource] = matched;
    }
    return obj;
  });
}

// --- Idempotency ---

const idempotencyCache = new Map<string, { response: unknown; status: number; createdAt: number }>();

// Clean expired keys every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache) {
    if (now - entry.createdAt > 24 * 60 * 60 * 1000) idempotencyCache.delete(key);
  }
}, 60 * 60 * 1000);

// --- Query Parsing ---

const RESERVED_PARAMS = new Set(['sort', 'order', 'page', 'limit', 'q', '_expand', '_embed', 'fields', 'cursor']);

function parseQueryOptions(query: Record<string, string>) {
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!RESERVED_PARAMS.has(key)) filters[key] = value;
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
    fields: query.fields ? query.fields.split(',') : undefined,
    cursor: query.cursor,
  };
}

// --- Common Response Helpers ---

function applyCommonHeaders(c: Context, mockId: string, resource: string) {
  const config = getResourceConfig(mockId, resource);
  const rateLimit = config?.rateLimit ?? 1000;
  applyRateLimitHeaders(c, mockId, resource, rateLimit);
  c.header('Access-Control-Expose-Headers', 'X-Total-Count, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Link, Location');
}

// --- Middleware ---

async function validateAndApplyConfig(c: Context, next: () => Promise<void>) {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');

  const mock = db.prepare('SELECT id FROM mocks WHERE id = ?').get(mockId);
  if (!mock) return problemJson(c, 404, 'Mock not found');

  const res = db.prepare('SELECT name, config_json FROM mock_resources WHERE mock_id = ? AND name = ?').get(mockId, resource) as
    | { name: string; config_json: string } | undefined;
  if (!res) return problemJson(c, 404, `Resource "${resource}" not found in this mock`);

  const config: ResourceConfig = JSON.parse(res.config_json || '{}');

  // Auth check
  if (config.auth) {
    const { type, key } = config.auth;
    if (type === 'apiKey') {
      const provided = c.req.header('X-API-Key');
      if (!provided) return problemJson(c, 401, 'Missing X-API-Key header');
      if (key && provided !== key) return problemJson(c, 401, 'Invalid API key');
    } else if (type === 'bearer') {
      const authHeader = c.req.header('Authorization');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) return problemJson(c, 401, 'Missing Authorization: Bearer token');
      if (key && token !== key) return problemJson(c, 401, 'Invalid bearer token');
    }
  }

  // Delay (fixed or distribution)
  if (config.delay) {
    const ms = computeDelay(config.delay);
    if (ms > 0) await sleep(ms);
  }

  if (config.forceStatus) {
    logRequest(mockId, c.req.method, c.req.path, config.forceStatus);
    return problemJson(c, config.forceStatus, `Forced status ${config.forceStatus}`);
  }

  if (config.errorRate && config.errorRate > 0 && Math.random() < config.errorRate) {
    const status = config.errorStatus || 500;
    logRequest(mockId, c.req.method, c.req.path, status);
    return problemJson(c, status, `Random error (${Math.round(config.errorRate * 100)}% rate)`);
  }

  await next();
}

dynamic.use('/:mockId/:resource/*', validateAndApplyConfig);
dynamic.use('/:mockId/:resource', validateAndApplyConfig);

// --- GET List ---

dynamic.get('/:mockId/:resource', (c) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');
  const opts = parseQueryOptions(c.req.query());
  const config = getResourceConfig(mockId, resource);

  const { data, total, hasMore, nextCursor } = queryRows(mockId, resource, opts);

  let result = data;
  if (opts._expand) result = expandRelations(mockId, result, opts._expand);
  if (opts._embed) result = embedRelations(mockId, result, resource, opts._embed);
  result = selectFields(result, opts.fields);

  applyCommonHeaders(c, mockId, resource);
  c.header('X-Total-Count', String(total));

  // Link header for pagination
  if (opts.page && opts.limit) {
    const linkHeader = buildLinkHeader(c.req.path, c.req.query(), opts.page, opts.limit, total);
    if (linkHeader) c.header('Link', linkHeader);
  }

  logRequest(mockId, 'GET', c.req.path, 200);

  // Build response body
  let responseBody: unknown;
  if (config?.envelope) {
    if (opts.cursor) {
      // Cursor-based envelope
      responseBody = {
        data: result,
        has_more: hasMore ?? false,
        next_cursor: nextCursor ?? null,
      };
    } else {
      const page = opts.page ?? 1;
      const limit = opts.limit ?? total;
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
      const basePath = c.req.path;
      const buildUrl = (p: number) => `${basePath}?page=${p}&limit=${limit}`;

      responseBody = {
        data: result,
        meta: { total, page, limit, totalPages },
        links: {
          self: buildUrl(page),
          first: buildUrl(1),
          last: buildUrl(totalPages),
          next: page < totalPages ? buildUrl(page + 1) : null,
          prev: page > 1 ? buildUrl(page - 1) : null,
        },
      };
    }
  } else {
    responseBody = result;
    // Cursor info in headers when not using envelope
    if (opts.cursor && nextCursor) c.header('X-Next-Cursor', nextCursor);
    if (opts.cursor && hasMore !== undefined) c.header('X-Has-More', String(hasMore));
  }

  // ETag + conditional
  const bodyStr = JSON.stringify(responseBody);
  const conditional = checkConditional(c, bodyStr);
  if (conditional) return conditional;

  return c.json(responseBody);
});

// --- GET Single ---

dynamic.get('/:mockId/:resource/:id', (c) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');
  const id = c.req.param('id');

  const row = getRowById(mockId, resource, id);
  if (!row) {
    logRequest(mockId, 'GET', c.req.path, 404);
    return problemJson(c, 404, `Item with id '${id}' not found in '${resource}'`);
  }

  const query = c.req.query();
  let result = [row];
  if (query._expand) result = expandRelations(mockId, result, query._expand.split(','));
  if (query._embed) result = embedRelations(mockId, result, resource, query._embed.split(','));
  if (query.fields) result = selectFields(result, query.fields.split(','));

  applyCommonHeaders(c, mockId, resource);
  logRequest(mockId, 'GET', c.req.path, 200);

  const config = getResourceConfig(mockId, resource);
  const item = result[0];
  const responseBody = config?.envelope ? { data: item } : item;

  const bodyStr = JSON.stringify(responseBody);
  const conditional = checkConditional(c, bodyStr);
  if (conditional) return conditional;

  return c.json(responseBody);
});

// --- GET Nested ---

dynamic.get('/:mockId/:resource/:id/:subResource', (c) => {
  const mockId = c.req.param('mockId');
  const parentResource = c.req.param('resource');
  const parentId = c.req.param('id');
  const subResource = c.req.param('subResource');

  const parent = getRowById(mockId, parentResource, parentId);
  if (!parent) return problemJson(c, 404, `${singularize(parentResource)} with id '${parentId}' not found`);

  const resources = getResourceNames(mockId);
  if (!resources.includes(subResource)) return problemJson(c, 404, `Resource "${subResource}" not found`);

  const fkField = findForeignKeyField(mockId, subResource, parentResource);
  if (!fkField) return problemJson(c, 400, `No foreign key found linking ${subResource} to ${parentResource}`);

  const opts = parseQueryOptions(c.req.query());
  opts.filters = { ...opts.filters, [fkField]: parentId };
  const { data, total } = queryRows(mockId, subResource, opts);

  let result = data;
  if (opts._expand) result = expandRelations(mockId, result, opts._expand);
  result = selectFields(result, opts.fields);

  applyCommonHeaders(c, mockId, subResource);
  c.header('X-Total-Count', String(total));
  logRequest(mockId, 'GET', c.req.path, 200);

  return c.json(result);
});

// --- POST ---

dynamic.post('/:mockId/:resource', async (c) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');

  // Idempotency key check
  const idempotencyKey = c.req.header('Idempotency-Key');
  if (idempotencyKey) {
    const cacheKey = `${mockId}:${resource}:${idempotencyKey}`;
    const cached = idempotencyCache.get(cacheKey);
    if (cached) {
      applyCommonHeaders(c, mockId, resource);
      return c.json(cached.response, cached.status as 200);
    }
  }

  const body = await c.req.json() as Record<string, unknown>;
  const now = new Date().toISOString();
  body.createdAt ??= now;
  body.updatedAt ??= now;
  const result = insertRow(mockId, resource, body);

  applyCommonHeaders(c, mockId, resource);

  // Location header
  const itemId = (result.data as Record<string, unknown>)?.id ?? result._row_id;
  c.header('Location', `/m/${mockId}/${resource}/${itemId}`);

  logRequest(mockId, 'POST', c.req.path, 201, JSON.stringify(body), JSON.stringify(result.data));

  const config = getResourceConfig(mockId, resource);

  // Cache idempotency response
  if (idempotencyKey) {
    const cacheKey = `${mockId}:${resource}:${idempotencyKey}`;
    const responseData = config?.envelope ? { data: result.data } : result.data;
    idempotencyCache.set(cacheKey, { response: responseData, status: 201, createdAt: Date.now() });
  }
  if (config?.webhookUrl) fireWebhook(config.webhookUrl, 'created', resource, result.data, config.webhookSecret);

  return c.json(config?.envelope ? { data: result.data } : result.data, 201);
});

// --- PUT ---

dynamic.put('/:mockId/:resource/:id', async (c) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');
  const body = await c.req.json() as Record<string, unknown>;
  body.updatedAt = new Date().toISOString();
  const updated = updateRow(mockId, resource, c.req.param('id'), body, false);
  if (!updated) {
    logRequest(mockId, 'PUT', c.req.path, 404, JSON.stringify(body));
    return problemJson(c, 404, `Item with id '${c.req.param('id')}' not found in '${resource}'`);
  }

  applyCommonHeaders(c, mockId, resource);
  logRequest(mockId, 'PUT', c.req.path, 200, JSON.stringify(body), JSON.stringify(updated));

  const config = getResourceConfig(mockId, resource);
  if (config?.webhookUrl) fireWebhook(config.webhookUrl, 'updated', resource, updated, config.webhookSecret);

  return c.json(config?.envelope ? { data: updated } : updated);
});

// --- PATCH ---

dynamic.patch('/:mockId/:resource/:id', async (c) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');
  const body = await c.req.json() as Record<string, unknown>;
  body.updatedAt = new Date().toISOString();
  const updated = updateRow(mockId, resource, c.req.param('id'), body, true);
  if (!updated) {
    logRequest(mockId, 'PATCH', c.req.path, 404, JSON.stringify(body));
    return problemJson(c, 404, `Item with id '${c.req.param('id')}' not found in '${resource}'`);
  }

  applyCommonHeaders(c, mockId, resource);
  logRequest(mockId, 'PATCH', c.req.path, 200, JSON.stringify(body), JSON.stringify(updated));

  const config = getResourceConfig(mockId, resource);
  if (config?.webhookUrl) fireWebhook(config.webhookUrl, 'updated', resource, updated, config.webhookSecret);

  return c.json(config?.envelope ? { data: updated } : updated);
});

// --- DELETE ---

dynamic.delete('/:mockId/:resource/:id', (c) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');
  const id = c.req.param('id');

  const item = getRowById(mockId, resource, id);
  const deleted = deleteRow(mockId, resource, id);
  if (!deleted) {
    logRequest(mockId, 'DELETE', c.req.path, 404);
    return problemJson(c, 404, `Item with id '${id}' not found in '${resource}'`);
  }

  applyCommonHeaders(c, mockId, resource);
  logRequest(mockId, 'DELETE', c.req.path, 200);

  const config = getResourceConfig(mockId, resource);
  if (config?.webhookUrl) fireWebhook(config.webhookUrl, 'deleted', resource, item, config.webhookSecret);

  return c.json({ message: 'Deleted' });
});

export { dynamic };
