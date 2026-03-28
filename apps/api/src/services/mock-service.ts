import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { createMockDataTable, dropMockDataTables, insertRow } from '../db/mock-tables.js';
import { inferSchema } from './schema-inferrer.js';
import type { MockDefinition, ResourceDefinition, CreateMockRequest } from '@mocksnap/shared';
import { API_BASE_URL } from '@mocksnap/shared';

export function createMock(request: CreateMockRequest): MockDefinition {
  const mockId = nanoid(10);
  const resources = inferSchema(request.sample);

  // Insert mock metadata
  db.prepare('INSERT INTO mocks (id, name) VALUES (?, ?)').run(mockId, request.name ?? null);

  const resourceDefs: ResourceDefinition[] = [];

  for (const resource of resources) {
    // Insert resource metadata
    db.prepare('INSERT INTO mock_resources (mock_id, name, schema_json) VALUES (?, ?, ?)').run(
      mockId,
      resource.name,
      JSON.stringify(resource.fields)
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

export function deleteMock(mockId: string): boolean {
  const mock = db.prepare('SELECT * FROM mocks WHERE id = ?').get(mockId) as { id: string } | undefined;
  if (!mock) return false;

  const resources = db.prepare('SELECT name FROM mock_resources WHERE mock_id = ?').all(mockId) as { name: string }[];
  dropMockDataTables(mockId, resources.map((r) => r.name));

  db.prepare('DELETE FROM mock_resources WHERE mock_id = ?').run(mockId);
  db.prepare('DELETE FROM mocks WHERE id = ?').run(mockId);
  return true;
}
