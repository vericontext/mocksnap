import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { generateOpenAPISpec } from '../services/openapi-generator.js';
import type { FieldDefinition } from '@mocksnap/shared';

const docs = new Hono();

function getMockMeta(mockId: string) {
  const mock = db.prepare('SELECT id, name FROM mocks WHERE id = ?').get(mockId) as
    | { id: string; name: string | null } | undefined;
  if (!mock) return null;

  const resources = db.prepare('SELECT name, schema_json FROM mock_resources WHERE mock_id = ?').all(mockId) as {
    name: string; schema_json: string;
  }[];

  return {
    name: mock.name || `Mock ${mock.id}`,
    resources: resources.map((r) => ({
      name: r.name,
      fields: JSON.parse(r.schema_json) as FieldDefinition[],
    })),
  };
}

// GET /m/:mockId/openapi.json
docs.get('/:mockId/openapi.json', (c) => {
  const mockId = c.req.param('mockId');
  const meta = getMockMeta(mockId);
  if (!meta) return c.json({ error: 'Not Found' }, 404);

  const spec = generateOpenAPISpec(mockId, meta.name, meta.resources);
  return c.json(spec);
});

// GET /m/:mockId/docs
docs.get('/:mockId/docs', (c) => {
  const mockId = c.req.param('mockId');
  const meta = getMockMeta(mockId);
  if (!meta) return c.text('Mock not found', 404);

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${meta.name} — API Docs</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/m/${mockId}/openapi.json" data-configuration='${JSON.stringify({
    theme: 'kepler',
    hideDownloadButton: false,
    hideModels: false,
  })}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;

  return c.html(html);
});

export { docs };
