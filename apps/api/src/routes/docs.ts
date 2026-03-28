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

// GET /m/:mockId/diagram — Mermaid ER diagram
docs.get('/:mockId/diagram', (c) => {
  const mockId = c.req.param('mockId');
  const meta = getMockMeta(mockId);
  if (!meta) return c.text('Mock not found', 404);

  const resourceNames = new Set(meta.resources.map((r) => r.name));

  function singularize(s: string): string {
    if (s.endsWith('ies')) return s.slice(0, -3) + 'y';
    if (s.endsWith('ses') || s.endsWith('xes') || s.endsWith('zes')) return s.slice(0, -2);
    if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1);
    return s;
  }

  // Build entities
  const entities: string[] = [];
  const relations: string[] = [];

  for (const resource of meta.resources) {
    const fieldLines = resource.fields.map((f) => {
      let marker = '';
      if (f.name === 'id') marker = ' PK';
      else if (f.name.endsWith('Id') || f.name.endsWith('_id')) marker = ' FK';
      return `        ${f.type} ${f.name}${marker}`;
    });
    entities.push(`    ${resource.name} {\n${fieldLines.join('\n')}\n    }`);

    // Detect FK relations
    for (const f of resource.fields) {
      let targetSingular: string | null = null;
      if (f.name.endsWith('Id')) targetSingular = f.name.slice(0, -2);
      else if (f.name.endsWith('_id')) targetSingular = f.name.slice(0, -3);
      if (!targetSingular) continue;

      const candidates = [targetSingular + 's', targetSingular + 'es', targetSingular.replace(/y$/, 'ies')];
      const target = candidates.find((c) => resourceNames.has(c));
      if (target) {
        relations.push(`    ${target} ||--o{ ${resource.name} : "has many"`);
      }
    }
  }

  const diagram = `erDiagram\n${entities.join('\n')}\n${relations.join('\n')}`;
  return c.text(diagram);
});

export { docs };
