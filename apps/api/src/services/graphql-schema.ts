import { createSchema } from 'graphql-yoga';
import type { FieldDefinition } from '@mocksnap/shared';
import { getAllRows, getRowById, insertRow, updateRow, deleteRow } from '../db/mock-tables.js';

interface ResourceInfo {
  name: string;
  fields: FieldDefinition[];
}

interface Relation {
  fromResource: string;
  fromField: string;
  toResource: string;
  type: 'belongsTo' | 'hasMany';
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

function toGraphQLType(fieldType: string): string {
  switch (fieldType) {
    case 'number': return 'Float';
    case 'boolean': return 'Boolean';
    case 'string': return 'String';
    case 'array': return 'String';
    case 'object': return 'String';
    default: return 'String';
  }
}

function detectRelations(resources: ResourceInfo[]): Relation[] {
  const resourceNames = new Set(resources.map((r) => r.name));
  const relations: Relation[] = [];

  for (const resource of resources) {
    for (const field of resource.fields) {
      // Detect FK fields: userId → users, post_id → posts
      let targetSingular: string | null = null;
      if (field.name.endsWith('Id')) {
        targetSingular = field.name.slice(0, -2);
      } else if (field.name.endsWith('_id')) {
        targetSingular = field.name.slice(0, -3);
      }

      if (!targetSingular) continue;

      // Find target resource (pluralized)
      const candidates = [targetSingular + 's', targetSingular + 'es', targetSingular.replace(/y$/, 'ies')];
      const targetResource = candidates.find((c) => resourceNames.has(c));
      if (!targetResource) continue;

      // N:1 — this resource belongs to target (Post.user → User)
      relations.push({
        fromResource: resource.name,
        fromField: field.name,
        toResource: targetResource,
        type: 'belongsTo',
      });

      // 1:N reverse — target has many of this resource (User.posts → [Post])
      relations.push({
        fromResource: targetResource,
        fromField: field.name,
        toResource: resource.name,
        type: 'hasMany',
      });
    }
  }

  return relations;
}

export function buildGraphQLSchema(mockId: string, resources: ResourceInfo[]) {
  const relations = detectRelations(resources);
  const typeDefinitions: string[] = [];
  const queryFields: string[] = [];
  const mutationFields: string[] = [];
  const resolvers: Record<string, Record<string, unknown>> = { Query: {}, Mutation: {} };

  for (const resource of resources) {
    const typeName = capitalize(singularize(resource.name));
    const inputName = `${typeName}Input`;

    // Build type fields
    const typeFieldLines = resource.fields.map((f) => {
      const gqlType = f.name === 'id' ? 'ID' : toGraphQLType(f.type);
      return `  ${f.name}: ${gqlType}`;
    });

    // Add relation fields to type
    const resourceRelations = relations.filter((r) => r.fromResource === resource.name);
    const typeResolvers: Record<string, unknown> = {};

    for (const rel of resourceRelations) {
      const targetTypeName = capitalize(singularize(rel.toResource));

      if (rel.type === 'belongsTo') {
        // Post.user: User (from userId FK)
        const fieldName = singularize(rel.toResource);
        typeFieldLines.push(`  ${fieldName}: ${targetTypeName}`);
        typeResolvers[fieldName] = (parent: Record<string, unknown>) => {
          const fkValue = parent[rel.fromField];
          if (fkValue === undefined || fkValue === null) return null;
          return getRowById(mockId, rel.toResource, String(fkValue));
        };
      } else if (rel.type === 'hasMany') {
        // User.posts: [Post!]!
        typeFieldLines.push(`  ${rel.toResource}: [${targetTypeName}!]!`);
        typeResolvers[rel.toResource] = (parent: Record<string, unknown>) => {
          const id = parent.id;
          if (id === undefined || id === null) return [];
          const allChildren = getAllRows(mockId, rel.toResource);
          return allChildren.filter((child) =>
            String((child as Record<string, unknown>)[rel.fromField]) === String(id)
          );
        };
      }
    }

    typeDefinitions.push(`type ${typeName} {\n${typeFieldLines.join('\n')}\n}`);

    if (Object.keys(typeResolvers).length > 0) {
      resolvers[typeName] = typeResolvers;
    }

    // Build input type (exclude id and relation fields)
    const inputFields = resource.fields
      .filter((f) => f.name !== 'id')
      .map((f) => `  ${f.name}: ${toGraphQLType(f.type)}`)
      .join('\n');

    if (inputFields) {
      typeDefinitions.push(`input ${inputName} {\n${inputFields}\n}`);
    }

    // Query: list all
    queryFields.push(`  ${resource.name}: [${typeName}!]!`);
    resolvers.Query[resource.name] = () => getAllRows(mockId, resource.name);

    // Query: get by id
    const singular = singularize(resource.name);
    queryFields.push(`  ${singular}(id: ID!): ${typeName}`);
    resolvers.Query[singular] = (_: unknown, args: { id: string }) =>
      getRowById(mockId, resource.name, args.id);

    // Mutation: create
    const createName = `create${typeName}`;
    if (inputFields) {
      mutationFields.push(`  ${createName}(input: ${inputName}!): ${typeName}!`);
      resolvers.Mutation[createName] = (_: unknown, args: { input: Record<string, unknown> }) => {
        if (!('id' in args.input)) {
          const rows = getAllRows(mockId, resource.name);
          const maxId = rows.reduce((max, row) => {
            const id = (row as Record<string, unknown>)?.id;
            return typeof id === 'number' && id > max ? id : max;
          }, 0);
          args.input.id = maxId + 1;
        }
        const result = insertRow(mockId, resource.name, args.input);
        return result.data;
      };
    }

    // Mutation: update
    const updateName = `update${typeName}`;
    if (inputFields) {
      mutationFields.push(`  ${updateName}(id: ID!, input: ${inputName}!): ${typeName}`);
      resolvers.Mutation[updateName] = (_: unknown, args: { id: string; input: Record<string, unknown> }) =>
        updateRow(mockId, resource.name, args.id, args.input, true);
    }

    // Mutation: delete
    const deleteName = `delete${typeName}`;
    mutationFields.push(`  ${deleteName}(id: ID!): Boolean!`);
    resolvers.Mutation[deleteName] = (_: unknown, args: { id: string }) =>
      deleteRow(mockId, resource.name, args.id);
  }

  const sdl = [
    ...typeDefinitions,
    `type Query {\n${queryFields.join('\n')}\n}`,
    mutationFields.length > 0 ? `type Mutation {\n${mutationFields.join('\n')}\n}` : '',
  ].filter(Boolean).join('\n\n');

  return createSchema({ typeDefs: sdl, resolvers });
}
