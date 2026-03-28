import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { createMockDataTable, dropMockDataTables, insertRow } from '../db/mock-tables.js';
import { inferSchema } from './schema-inferrer.js';
import { generateFromPrompt, amplifyData } from './ai-service.js';
import { parseOpenAPISpec } from './openapi-parser.js';
import type { MockDefinition, MockListItem, ResourceDefinition, CreateMockRequest } from '@mocksnap/shared';
import { API_BASE_URL } from '@mocksnap/shared';

export async function createMock(request: CreateMockRequest): Promise<MockDefinition> {
  const mockId = nanoid(10);

  const apiKey = request.anthropicApiKey;
  const hasAI = !!(apiKey || process.env.ANTHROPIC_API_KEY);

  let sample: Record<string, unknown>;
  let fromOpenAPI = false;

  if (request.openapi) {
    const { resources: parsedResources } = parseOpenAPISpec(request.openapi);
    if (hasAI) {
      const schemaDesc = parsedResources.map((r) =>
        `${r.name}: ${r.fields.map((f) => `${f.name}(${f.type})`).join(', ')}`
      ).join('\n');
      sample = await generateFromPrompt(
        `Generate realistic sample data for these API resources:\n${schemaDesc}\n10 items per resource, realistic data.`,
        apiKey
      );
    } else {
      sample = {};
      for (const r of parsedResources) {
        const item: Record<string, unknown> = {};
        for (const f of r.fields) {
          if (f.name === 'id') item.id = 1;
          else if (f.type === 'number') item[f.name] = 0;
          else if (f.type === 'boolean') item[f.name] = false;
          else item[f.name] = `sample_${f.name}`;
        }
        sample[r.name] = [item];
      }
    }
    fromOpenAPI = true;
  } else if (request.prompt && !request.sample) {
    sample = await generateFromPrompt(request.prompt, apiKey);
  } else if (request.sample) {
    sample = request.sample;
  } else {
    throw new Error('Either "sample", "prompt", or "openapi" is required');
  }

  const resources = inferSchema(sample);

  // AI data amplification
  const shouldAmplify = request.amplify !== false && hasAI;
  const amplifyCount = request.amplifyCount ?? 10;

  if (shouldAmplify && !request.prompt && !fromOpenAPI) {
    for (const resource of resources) {
      try {
        const extraData = await amplifyData(resource.name, resource.fields, resource.seedData, amplifyCount, apiKey);
        resource.seedData.push(...extraData);
      } catch {
        // If amplification fails, continue with original seed data
      }
    }
  }

  // Insert mock metadata
  db.prepare('INSERT INTO mocks (id, name) VALUES (?, ?)').run(mockId, request.name ?? null);

  const resourceDefs: ResourceDefinition[] = [];

  for (const resource of resources) {
    // Insert resource metadata
    db.prepare('INSERT INTO mock_resources (mock_id, name, schema_json, seed_data) VALUES (?, ?, ?, ?)').run(
      mockId,
      resource.name,
      JSON.stringify(resource.fields),
      JSON.stringify(resource.seedData)
    );

    // Create data table and seed
    createMockDataTable(mockId, resource.name);
    for (const item of resource.seedData) {
      insertRow(mockId, resource.name, item);
    }

    const base = `/m/${mockId}/${resource.name}`;
    resourceDefs.push({
      name: resource.name,
      count: resource.seedData.length,
      fields: resource.fields,
      endpoints: {
        list: `GET    ${base}`,
        get: `GET    ${base}/:id`,
        create: `POST   ${base}`,
        update: `PUT    ${base}/:id`,
        patch: `PATCH  ${base}/:id`,
        delete: `DELETE ${base}/:id`,
      },
    });
  }

  return {
    id: mockId,
    name: request.name,
    resources: resourceDefs,
    baseUrl: `${API_BASE_URL}/m/${mockId}`,
    graphqlUrl: `${API_BASE_URL}/m/${mockId}/graphql`,
    createdAt: new Date().toISOString(),
  };
}

export function getMock(mockId: string): MockDefinition | null {
  const mock = db.prepare('SELECT * FROM mocks WHERE id = ?').get(mockId) as
    | { id: string; name: string | null; created_at: string }
    | undefined;

  if (!mock) return null;

  const resources = db.prepare('SELECT * FROM mock_resources WHERE mock_id = ?').all(mockId) as {
    name: string;
    schema_json: string;
  }[];

  return {
    id: mock.id,
    name: mock.name ?? undefined,
    resources: resources.map((r) => {
      const base = `/m/${mockId}/${r.name}`;
      return {
        name: r.name,
        count: 0, // Could query actual count if needed
        fields: JSON.parse(r.schema_json),
        endpoints: {
          list: `GET    ${base}`,
          get: `GET    ${base}/:id`,
          create: `POST   ${base}`,
          update: `PUT    ${base}/:id`,
          patch: `PATCH  ${base}/:id`,
          delete: `DELETE ${base}/:id`,
        },
      };
    }),
    baseUrl: `${API_BASE_URL}/m/${mockId}`,
    createdAt: mock.created_at,
  };
}

export function listMocks(): MockListItem[] {
  const mocks = db.prepare('SELECT id, name, created_at FROM mocks ORDER BY created_at DESC').all() as {
    id: string;
    name: string | null;
    created_at: string;
  }[];

  return mocks.map((m) => {
    const resourceCount = (db.prepare('SELECT COUNT(*) as cnt FROM mock_resources WHERE mock_id = ?').get(m.id) as { cnt: number }).cnt;
    return {
      id: m.id,
      name: m.name ?? undefined,
      resourceCount,
      createdAt: m.created_at,
      baseUrl: `${API_BASE_URL}/m/${m.id}`,
    };
  });
}

export function deleteMock(mockId: string): boolean {
  const mock = db.prepare('SELECT * FROM mocks WHERE id = ?').get(mockId) as { id: string } | undefined;
  if (!mock) return false;

  const resources = db.prepare('SELECT name FROM mock_resources WHERE mock_id = ?').all(mockId) as { name: string }[];
  dropMockDataTables(mockId, resources.map((r) => r.name));

  db.prepare('DELETE FROM mock_resources WHERE mock_id = ?').run(mockId);
  db.prepare('DELETE FROM mocks WHERE id = ?').run(mockId);
  return true;
}
