import { createSchema } from 'graphql-yoga';
import type { FieldDefinition } from '@mocksnap/shared';
import { getAllRows, getRowById, insertRow, updateRow, deleteRow } from '../db/mock-tables.js';

interface ResourceInfo {
  name: string;
  fields: FieldDefinition[];
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
    case 'array': return 'String'; // JSON serialized
    case 'object': return 'String'; // JSON serialized
    default: return 'String';
  }
}

export function buildGraphQLSchema(mockId: string, resources: ResourceInfo[]) {
  const typeDefinitions: string[] = [];
  const queryFields: string[] = [];
  const mutationFields: string[] = [];
  const resolvers: Record<string, Record<string, unknown>> = { Query: {}, Mutation: {} };

  for (const resource of resources) {
    const typeName = capitalize(singularize(resource.name));
    const inputName = `${typeName}Input`;

    // Build type definition
    const typeFields = resource.fields.map((f) => {
      const gqlType = f.name === 'id' ? 'ID' : toGraphQLType(f.type);
      return `  ${f.name}: ${gqlType}`;
    }).join('\n');

    typeDefinitions.push(`type ${typeName} {\n${typeFields}\n}`);

    // Build input type (exclude id)
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
        // Auto-assign id if not provided
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
