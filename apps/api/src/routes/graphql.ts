import { Hono } from 'hono';
import { createYoga } from 'graphql-yoga';
import { db } from '../db/connection.js';
import { buildGraphQLSchema } from '../services/graphql-schema.js';
import type { FieldDefinition } from '@mocksnap/shared';

const graphql = new Hono();

// Cache schemas per mockId to avoid rebuilding on every request
const schemaCache = new Map<string, { schema: ReturnType<typeof buildGraphQLSchema>; updatedAt: string }>();

function getOrBuildSchema(mockId: string) {
  const mock = db.prepare('SELECT updated_at FROM mocks WHERE id = ?').get(mockId) as { updated_at: string } | undefined;
  if (!mock) return null;

  const cached = schemaCache.get(mockId);
  if (cached && cached.updatedAt === mock.updated_at) {
    return cached.schema;
  }

  const resources = db.prepare('SELECT name, schema_json FROM mock_resources WHERE mock_id = ?').all(mockId) as {
    name: string;
    schema_json: string;
  }[];

  if (resources.length === 0) return null;

  const resourceInfos = resources.map((r) => ({
    name: r.name,
    fields: JSON.parse(r.schema_json) as FieldDefinition[],
  }));

  const schema = buildGraphQLSchema(mockId, resourceInfos);
  schemaCache.set(mockId, { schema, updatedAt: mock.updated_at });
  return schema;
}

// Handle both GET and POST for GraphQL
graphql.all('/:mockId/graphql', async (c) => {
  const mockId = c.req.param('mockId');
  const schema = getOrBuildSchema(mockId);

  if (!schema) {
    return c.json({ error: 'Not Found', message: 'Mock not found or has no resources' }, 404);
  }

  const yoga = createYoga({ schema, graphqlEndpoint: `/m/${mockId}/graphql` });

  // Convert Hono request to a standard Request for yoga
  const response = await yoga.handle(c.req.raw, {});
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
});

export { graphql };
