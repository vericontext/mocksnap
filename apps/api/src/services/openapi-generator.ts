import type { FieldDefinition } from '@mocksnap/shared';
import { API_BASE_URL } from '@mocksnap/shared';

interface ResourceMeta {
  name: string;
  fields: FieldDefinition[];
}

function toJsonSchemaType(fieldType: string): { type: string; format?: string } {
  switch (fieldType) {
    case 'number': return { type: 'number' };
    case 'boolean': return { type: 'boolean' };
    case 'array': return { type: 'array' };
    case 'object': return { type: 'object' };
    default: return { type: 'string' };
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function singularize(s: string): string {
  if (s.endsWith('ies')) return s.slice(0, -3) + 'y';
  if (s.endsWith('ses') || s.endsWith('xes') || s.endsWith('zes')) return s.slice(0, -2);
  if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1);
  return s;
}

export function generateOpenAPISpec(mockId: string, mockName: string, resources: ResourceMeta[]): Record<string, unknown> {
  const basePath = `/m/${mockId}`;
  const schemas: Record<string, unknown> = {};
  const paths: Record<string, unknown> = {};

  for (const resource of resources) {
    const schemaName = capitalize(singularize(resource.name));
    const properties: Record<string, unknown> = {};

    for (const field of resource.fields) {
      if (field.name === 'id') {
        properties.id = { type: 'integer', description: 'Unique identifier' };
      } else {
        properties[field.name] = {
          ...toJsonSchemaType(field.type),
          ...(field.nullable ? { nullable: true } : {}),
        };
      }
    }

    // Add auto-generated fields
    properties.createdAt = { type: 'string', format: 'date-time', description: 'Auto-generated on create' };
    properties.updatedAt = { type: 'string', format: 'date-time', description: 'Auto-updated on modify' };

    schemas[schemaName] = {
      type: 'object',
      properties,
    };

    schemas[`${schemaName}Input`] = {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(properties).filter(([k]) => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt')
      ),
    };

    const tag = resource.name;
    const ref = `#/components/schemas/${schemaName}`;
    const inputRef = `#/components/schemas/${schemaName}Input`;

    // Common query parameters
    const listParams = [
      { name: 'sort', in: 'query', schema: { type: 'string' }, description: 'Sort by field name' },
      { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] }, description: 'Sort order' },
      { name: 'page', in: 'query', schema: { type: 'integer' }, description: 'Page number (offset pagination)' },
      { name: 'limit', in: 'query', schema: { type: 'integer' }, description: 'Items per page' },
      { name: 'cursor', in: 'query', schema: { type: 'string' }, description: 'Cursor for cursor-based pagination' },
      { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Full-text search' },
      { name: 'fields', in: 'query', schema: { type: 'string' }, description: 'Comma-separated field names to return' },
      { name: '_expand', in: 'query', schema: { type: 'string' }, description: 'Expand FK relations (e.g. user,user.posts)' },
      { name: '_embed', in: 'query', schema: { type: 'string' }, description: 'Embed child resources (e.g. posts,posts.comments)' },
    ];

    // GET list + POST
    paths[`${basePath}/${resource.name}`] = {
      get: {
        tags: [tag],
        summary: `List all ${resource.name}`,
        parameters: listParams,
        responses: {
          '200': {
            description: 'Success',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: ref } } } },
            headers: {
              'X-Total-Count': { schema: { type: 'integer' }, description: 'Total number of items' },
              'ETag': { schema: { type: 'string' }, description: 'Entity tag for conditional requests' },
            },
          },
          '304': { description: 'Not Modified (ETag match)' },
        },
      },
      post: {
        tags: [tag],
        summary: `Create a ${singularize(resource.name)}`,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: inputRef } } },
        },
        parameters: [
          { name: 'Idempotency-Key', in: 'header', schema: { type: 'string' }, description: 'Prevent duplicate creation' },
        ],
        responses: {
          '201': {
            description: 'Created',
            content: { 'application/json': { schema: { $ref: ref } } },
            headers: {
              'Location': { schema: { type: 'string' }, description: 'URL of the created resource' },
            },
          },
        },
      },
    };

    // GET/PUT/PATCH/DELETE by id
    paths[`${basePath}/${resource.name}/{id}`] = {
      get: {
        tags: [tag],
        summary: `Get a ${singularize(resource.name)} by ID`,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: '_expand', in: 'query', schema: { type: 'string' } },
          { name: '_embed', in: 'query', schema: { type: 'string' } },
          { name: 'If-None-Match', in: 'header', schema: { type: 'string' }, description: 'ETag for conditional request' },
        ],
        responses: {
          '200': { description: 'Success', content: { 'application/json': { schema: { $ref: ref } } } },
          '304': { description: 'Not Modified' },
          '404': { description: 'Not Found' },
        },
      },
      put: {
        tags: [tag],
        summary: `Replace a ${singularize(resource.name)}`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: inputRef } } } },
        responses: {
          '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: ref } } } },
          '404': { description: 'Not Found' },
        },
      },
      patch: {
        tags: [tag],
        summary: `Partially update a ${singularize(resource.name)}`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: inputRef } } } },
        responses: {
          '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: ref } } } },
          '404': { description: 'Not Found' },
        },
      },
      delete: {
        tags: [tag],
        summary: `Delete a ${singularize(resource.name)}`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Deleted' },
          '404': { description: 'Not Found' },
        },
      },
    };
  }

  return {
    openapi: '3.0.3',
    info: {
      title: mockName || `Mock ${mockId}`,
      version: '1.0.0',
      description: `Auto-generated API documentation for MockSnap mock "${mockName || mockId}".\n\nBase URL: ${API_BASE_URL}${basePath}`,
    },
    servers: [{ url: API_BASE_URL, description: 'MockSnap API Server' }],
    paths,
    components: { schemas },
  };
}
