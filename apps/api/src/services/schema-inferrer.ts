import { faker } from '@faker-js/faker';
import type { FieldDefinition, FieldType } from '@mocksnap/shared';

interface InferredResource {
  name: string;
  fields: FieldDefinition[];
  seedData: unknown[];
}

// Field name → Faker generator mapping
const FAKER_MAP: Record<string, () => unknown> = {
  email: () => faker.internet.email(),
  name: () => faker.person.fullName(),
  firstName: () => faker.person.firstName(),
  first_name: () => faker.person.firstName(),
  lastName: () => faker.person.lastName(),
  last_name: () => faker.person.lastName(),
  phone: () => faker.phone.number(),
  address: () => faker.location.streetAddress(),
  city: () => faker.location.city(),
  country: () => faker.location.country(),
  zip: () => faker.location.zipCode(),
  zipCode: () => faker.location.zipCode(),
  company: () => faker.company.name(),
  title: () => faker.lorem.sentence({ min: 3, max: 8 }),
  description: () => faker.lorem.paragraph(),
  body: () => faker.lorem.paragraphs(2),
  content: () => faker.lorem.paragraphs(2),
  bio: () => faker.lorem.sentence(),
  url: () => faker.internet.url(),
  website: () => faker.internet.url(),
  avatar: () => faker.image.avatar(),
  image: () => faker.image.url(),
  username: () => faker.internet.username(),
  password: () => faker.internet.password(),
  price: () => Number(faker.commerce.price()),
  amount: () => Number(faker.finance.amount()),
  color: () => faker.color.human(),
  category: () => faker.commerce.department(),
  status: () => faker.helpers.arrayElement(['active', 'inactive', 'pending']),
  role: () => faker.helpers.arrayElement(['admin', 'user', 'editor']),
  age: () => faker.number.int({ min: 18, max: 65 }),
  rating: () => faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
  lat: () => faker.location.latitude(),
  lng: () => faker.location.longitude(),
  latitude: () => faker.location.latitude(),
  longitude: () => faker.location.longitude(),
};

export function generateSmartValue(fieldName: string, fieldType: FieldType): unknown {
  const lower = fieldName.toLowerCase();

  // Exact match
  if (FAKER_MAP[fieldName]) return FAKER_MAP[fieldName]();

  // Partial match
  for (const [pattern, gen] of Object.entries(FAKER_MAP)) {
    if (lower.includes(pattern.toLowerCase())) return gen();
  }

  // Type-based fallback
  switch (fieldType) {
    case 'string': return faker.lorem.word();
    case 'number': return faker.number.int({ min: 1, max: 1000 });
    case 'boolean': return faker.datatype.boolean();
    default: return null;
  }
}

export function generateFakerData(fields: FieldDefinition[], count: number, startId: number = 1): unknown[] {
  return Array.from({ length: count }, (_, i) => {
    const item: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.name === 'id') {
        item.id = startId + i;
      } else {
        item[field.name] = generateSmartValue(field.name, field.type);
      }
    }
    return item;
  });
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
