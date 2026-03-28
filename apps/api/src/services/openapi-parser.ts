import yaml from 'js-yaml';
import type { FieldDefinition, FieldType } from '@mocksnap/shared';

interface ParsedResource {
  name: string;
  fields: FieldDefinition[];
}

interface OpenAPISpec {
  openapi?: string;
  paths?: Record<string, unknown>;
  components?: {
    schemas?: Record<string, SchemaObject>;
  };
}

interface SchemaObject {
  type?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  items?: SchemaProperty;
}

interface SchemaProperty {
  type?: string;
  format?: string;
  $ref?: string;
  items?: SchemaProperty;
  enum?: unknown[];
}

function mapOpenAPIType(prop: SchemaProperty): FieldType {
  switch (prop.type) {
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'array';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
}

function resolveRef(spec: OpenAPISpec, ref: string): SchemaObject | null {
  // Handle $ref like "#/components/schemas/Pet"
  const parts = ref.replace('#/', '').split('/');
  let current: unknown = spec;
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return current as SchemaObject | null;
}

function extractFieldsFromSchema(spec: OpenAPISpec, schema: SchemaObject): FieldDefinition[] {
  const fields: FieldDefinition[] = [];
  if (!schema.properties) return fields;

  for (const [name, prop] of Object.entries(schema.properties)) {
    if (prop.$ref) {
      // Nested schema reference — treat as object
      fields.push({ name, type: 'object' });
    } else {
      fields.push({
        name,
        type: mapOpenAPIType(prop),
        nullable: schema.required ? !schema.required.includes(name) : true,
      });
    }
  }
  return fields;
}

function extractResourcesFromPaths(paths: Record<string, unknown>): Set<string> {
  const resources = new Set<string>();
  for (const path of Object.keys(paths)) {
    // Extract resource name: /pets → pets, /pets/{id} → pets, /api/v1/users → users
    const segments = path.split('/').filter(Boolean);
    for (const seg of segments) {
      if (!seg.startsWith('{') && !['api', 'v1', 'v2', 'v3'].includes(seg)) {
        resources.add(seg.toLowerCase());
      }
    }
  }
  return resources;
}

function findSchemaForResource(spec: OpenAPISpec, resourceName: string): SchemaObject | null {
  const schemas = spec.components?.schemas;
  if (!schemas) return null;

  // Try singular form match (pets → Pet, users → User)
  const singular = resourceName.endsWith('s') ? resourceName.slice(0, -1) : resourceName;

  for (const [name, schema] of Object.entries(schemas)) {
    const lower = name.toLowerCase();
    if (lower === resourceName || lower === singular) {
      return schema;
    }
  }

  // If paths reference a schema via $ref in responses, try to extract that
  return null;
}

export function parseOpenAPISpec(specString: string): { resources: ParsedResource[]; spec: OpenAPISpec } {
  let spec: OpenAPISpec;

  // Try JSON first, then YAML
  try {
    spec = JSON.parse(specString);
  } catch {
    try {
      spec = yaml.load(specString) as OpenAPISpec;
    } catch {
      throw new Error('Invalid OpenAPI spec: could not parse as JSON or YAML');
    }
  }

  if (!spec || typeof spec !== 'object') {
    throw new Error('Invalid OpenAPI spec: not an object');
  }

  const resources: ParsedResource[] = [];

  // Extract resources from paths
  const resourceNames = spec.paths ? extractResourcesFromPaths(spec.paths) : new Set<string>();

  // If no paths but has schemas, use schema names as resources
  if (resourceNames.size === 0 && spec.components?.schemas) {
    for (const name of Object.keys(spec.components.schemas)) {
      resourceNames.add(name.toLowerCase() + 's'); // pluralize
    }
  }

  for (const name of resourceNames) {
    const schema = findSchemaForResource(spec, name);
    const fields: FieldDefinition[] = schema
      ? extractFieldsFromSchema(spec, schema)
      : [{ name: 'id', type: 'number' as FieldType }];

    // Ensure id field exists
    if (!fields.some((f) => f.name === 'id')) {
      fields.unshift({ name: 'id', type: 'number' });
    }

    resources.push({ name, fields });
  }

  if (resources.length === 0) {
    throw new Error('No resources found in OpenAPI spec. Ensure paths or schemas are defined.');
  }

  return { resources, spec };
}
