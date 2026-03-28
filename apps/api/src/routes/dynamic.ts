import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { getAllRows, getRowById, insertRow, updateRow, deleteRow } from '../db/mock-tables.js';

const dynamic = new Hono();

// Middleware: validate mock and resource exist
dynamic.use('/:mockId/:resource/*', async (c, next) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');

  const mock = db.prepare('SELECT id FROM mocks WHERE id = ?').get(mockId);
  if (!mock) {
    return c.json({ error: 'Not Found', message: 'Mock not found' }, 404);
  }

  const res = db.prepare('SELECT name FROM mock_resources WHERE mock_id = ? AND name = ?').get(mockId, resource);
  if (!res) {
    return c.json({ error: 'Not Found', message: `Resource "${resource}" not found in this mock` }, 404);
  }

  await next();
});

dynamic.use('/:mockId/:resource', async (c, next) => {
  const mockId = c.req.param('mockId');
  const resource = c.req.param('resource');

  const mock = db.prepare('SELECT id FROM mocks WHERE id = ?').get(mockId);
  if (!mock) {
    return c.json({ error: 'Not Found', message: 'Mock not found' }, 404);
  }

  const res = db.prepare('SELECT name FROM mock_resources WHERE mock_id = ? AND name = ?').get(mockId, resource);
  if (!res) {
    return c.json({ error: 'Not Found', message: `Resource "${resource}" not found in this mock` }, 404);
  }

  await next();
});

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
