import { Hono } from 'hono';
import { db } from '../db/connection.js';
import type { ResourceConfig } from '@mocksnap/shared';

const config = new Hono();

// GET /api/mocks/:mockId/resources/:resource/config
config.get('/:mockId/resources/:resource/config', (c) => {
  const { mockId, resource } = c.req.param();

  const row = db.prepare(
    'SELECT config_json FROM mock_resources WHERE mock_id = ? AND name = ?'
  ).get(mockId, resource) as { config_json: string } | undefined;

  if (!row) {
    return c.json({ error: 'Not Found', message: 'Resource not found' }, 404);
  }

  return c.json(JSON.parse(row.config_json || '{}'));
});

// PATCH /api/mocks/:mockId/resources/:resource/config
config.patch('/:mockId/resources/:resource/config', async (c) => {
  const { mockId, resource } = c.req.param();
  const body = await c.req.json<Partial<ResourceConfig>>();

  const row = db.prepare(
    'SELECT config_json FROM mock_resources WHERE mock_id = ? AND name = ?'
  ).get(mockId, resource) as { config_json: string } | undefined;

  if (!row) {
    return c.json({ error: 'Not Found', message: 'Resource not found' }, 404);
  }

  const existing: ResourceConfig = JSON.parse(row.config_json || '{}');
  const updated = { ...existing, ...body };

  // Remove undefined/null values
  for (const key of Object.keys(updated) as (keyof ResourceConfig)[]) {
    if (updated[key] === null || updated[key] === undefined) {
      delete updated[key];
    }
  }

  db.prepare(
    'UPDATE mock_resources SET config_json = ? WHERE mock_id = ? AND name = ?'
  ).run(JSON.stringify(updated), mockId, resource);

  return c.json(updated);
});

export { config };
