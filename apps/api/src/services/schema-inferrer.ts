import type { FieldDefinition, FieldType } from '@mocksnap/shared';

interface InferredResource {
  name: string;
  fields: FieldDefinition[];
  seedData: unknown[];
}

function inferFieldType(value: unknown): FieldType {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'string') return 'string';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  if (t === 'object') return 'object';
  return 'string';
}

function inferFields(items: unknown[]): FieldDefinition[] {
  const fieldMap = new Map<string, { types: Set<FieldType>; hasNull: boolean }>();

  for (const item of items) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
      const existing = fieldMap.get(key) ?? { types: new Set(), hasNull: false };
      const t = inferFieldType(value);
      if (t === 'null') {
        existing.hasNull = true;
      } else {
        existing.types.add(t);
      }
      fieldMap.set(key, existing);
    }
  }

  return Array.from(fieldMap.entries()).map(([name, info]) => ({
    name,
    type: info.types.size > 0 ? [...info.types][0] : 'string',
    nullable: info.hasNull || undefined,
  }));
}

function validateResourceName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

export function inferSchema(sample: unknown): InferredResource[] {
  // Case 1: { "users": [...], "posts": [...] }
  if (typeof sample === 'object' && sample !== null && !Array.isArray(sample)) {
    const entries = Object.entries(sample as Record<string, unknown>);
    const resources: InferredResource[] = [];

    for (const [key, value] of entries) {
      const name = validateResourceName(key);
      if (Array.isArray(value)) {
        resources.push({
          name,
          fields: inferFields(value),
          seedData: value,
        });
      } else if (typeof value === 'object' && value !== null) {
        // Single object → treat as array of one
        resources.push({
          name,
          fields: inferFields([value]),
          seedData: [value],
        });
      }
    }

    // If no array/object values found, treat the whole thing as a single item
    if (resources.length === 0) {
      resources.push({
        name: 'items',
        fields: inferFields([sample]),
        seedData: [sample],
      });
    }

    return resources;
  }

  // Case 2: bare array [...]
  if (Array.isArray(sample)) {
    return [{
      name: 'items',
      fields: inferFields(sample),
      seedData: sample,
    }];
  }

  // Case 3: primitive or unexpected → wrap
  return [{
    name: 'items',
    fields: [],
    seedData: [sample],
  }];
}
