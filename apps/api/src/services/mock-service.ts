import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { createMockDataTable, dropMockDataTables, insertRow, resetTable } from '../db/mock-tables.js';
import { inferSchema, generateFakerData } from './schema-inferrer.js';
import { generateFromPrompt, amplifyData, modifyMockSchema } from './ai-service.js';
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
  } else if (request.amplify !== false && !hasAI && !request.prompt && !fromOpenAPI) {
    // Faker.js fallback when no AI key available
    for (const resource of resources) {
      const maxId = resource.seedData.reduce((max, item) => {
        const id = (item as Record<string, unknown>)?.id;
        return typeof id === 'number' && id > max ? id : max;
      }, 0);
      const fakerData = generateFakerData(resource.fields, amplifyCount, maxId + 1);
      resource.seedData.push(...fakerData);
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

export async function modifyMockWithChat(
  mockId: string,
  message: string,
  apiKey?: string
): Promise<{ changes: string[]; mock: MockDefinition }> {
  // Load current schema
  const currentResources = db.prepare('SELECT name, schema_json FROM mock_resources WHERE mock_id = ?').all(mockId) as {
    name: string; schema_json: string;
  }[];

  if (currentResources.length === 0) throw new Error('Mock not found');

  const currentSchema = currentResources.map((r) => ({
    name: r.name,
    fields: JSON.parse(r.schema_json),
  }));

  // Ask AI for modifications
  const { resources: newResources, changes } = await modifyMockSchema(currentSchema, message, apiKey);

  const existingNames = new Set(currentResources.map((r) => r.name));
  const newNames = new Set(Object.keys(newResources));

  // Remove resources that AI didn't include
  for (const name of existingNames) {
    if (!newNames.has(name)) {
      db.exec(`DROP TABLE IF EXISTS "mock_${mockId.replace(/[^a-zA-Z0-9_]/g, '')}_${name.replace(/[^a-zA-Z0-9_]/g, '')}"`);
      db.prepare('DELETE FROM mock_resources WHERE mock_id = ? AND name = ?').run(mockId, name);
    }
  }

  // Add or update resources
  const inferredResources = inferSchema(newResources);
  for (const resource of inferredResources) {
    const seedJson = JSON.stringify(resource.seedData);
    const fieldsJson = JSON.stringify(resource.fields);

    if (existingNames.has(resource.name)) {
      // Update existing
      db.prepare('UPDATE mock_resources SET schema_json = ?, seed_data = ? WHERE mock_id = ? AND name = ?')
        .run(fieldsJson, seedJson, mockId, resource.name);
      resetTable(mockId, resource.name, resource.seedData);
    } else {
      // Create new
      db.prepare('INSERT INTO mock_resources (mock_id, name, schema_json, seed_data) VALUES (?, ?, ?, ?)')
        .run(mockId, resource.name, fieldsJson, seedJson);
      createMockDataTable(mockId, resource.name);
      for (const item of resource.seedData) {
        insertRow(mockId, resource.name, item);
      }
    }
  }

  // Update timestamp
  db.prepare("UPDATE mocks SET updated_at = datetime('now') WHERE id = ?").run(mockId);

  // Return updated mock
  const mock = getMock(mockId)!;
  return { changes, mock };
}
