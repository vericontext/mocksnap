import Anthropic from '@anthropic-ai/sdk';
import type { FieldDefinition } from '@mocksnap/shared';

function getClient(apiKey?: string): Anthropic {
  return new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
}

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/);
  if (jsonMatch) return jsonMatch[0].trim();
  return text.trim();
}

export async function generateFromPrompt(prompt: string, apiKey?: string): Promise<Record<string, unknown[]>> {
  const client = getClient(apiKey);
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are an API schema designer. Given a natural language description, generate a JSON object with realistic sample data for a REST API.

<instructions>
1. Return a single JSON object where each top-level key is a resource name (plural, lowercase, English).
2. Each resource value is an array of 5-10 realistic data items.
3. Every item must have an "id" field (auto-incrementing integer starting from 1).
4. If the user describes relationships between resources, create matching foreign key fields (e.g. "authorId" or "author_id") with valid reference IDs.
5. Generate contextually realistic data: real-sounding names, valid email formats, realistic ages (20-60), proper dates (ISO format), meaningful descriptions.
6. Use English data by default unless the user specifies another language.
</instructions>

<output_format>
Return ONLY valid JSON. No explanation, no markdown, no code blocks. The response must be parseable by JSON.parse().
</output_format>`,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = JSON.parse(extractJson(text));

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('AI returned invalid format: expected an object with array values');
  }

  return parsed as Record<string, unknown[]>;
}

export async function amplifyData(
  resourceName: string,
  fields: FieldDefinition[],
  seedData: unknown[],
  count: number,
  apiKey?: string
): Promise<unknown[]> {
  const client = getClient(apiKey);
  const maxId = seedData.reduce((max, item) => {
    const id = (item as Record<string, unknown>)?.id;
    return typeof id === 'number' && id > max ? id : max;
  }, 0);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a realistic data generator. Given a schema and sample data, generate more items that match the exact same pattern, field names, and style.

<critical_rules>
1. Match the EXACT field names from the schema. Do not rename, add, or remove any fields.
2. Start id from ${maxId + 1} and auto-increment.
3. Match the language and style of existing data (if English, generate English).
4. Generate contextually realistic values: valid emails, ages 20-60, dates in ISO format, meaningful text.
</critical_rules>

<output_format>
Return ONLY a valid JSON array. No explanation, no markdown, no code blocks.
</output_format>`,
    messages: [{
      role: 'user',
      content: `Schema for "${resourceName}":
Fields: ${JSON.stringify(fields)}

Existing data (${seedData.length} items):
${JSON.stringify(seedData, null, 2)}

Generate ${count} more items matching this exact pattern.`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = JSON.parse(extractJson(text));

  if (!Array.isArray(parsed)) {
    throw new Error('AI returned invalid format: expected an array');
  }

  return parsed;
}

export async function modifyMockSchema(
  currentResources: { name: string; fields: { name: string; type: string }[] }[],
  message: string,
  apiKey?: string
): Promise<{ resources: Record<string, unknown[]>; changes: string[] }> {
  const client = getClient(apiKey);

  const schemaDescription = currentResources.map((r) =>
    `${r.name}: ${r.fields.map((f) => `${f.name}(${f.type})`).join(', ')}`
  ).join('\n');

  const resourceNames = currentResources.map((r) => r.name);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: `You are a precise API schema modifier. Your job is to apply the user's requested changes to an existing API schema and return the updated version.

<current_schema>
${schemaDescription}
</current_schema>

<critical_rules>
1. NEVER remove or omit an existing resource unless the user EXPLICITLY asks to remove it. All ${resourceNames.length} current resources (${resourceNames.join(', ')}) MUST appear in your response.
2. NEVER rename existing fields unless the user EXPLICITLY asks to rename them. Preserve exact field names including casing (e.g. keep "author_id" as "author_id", keep "userId" as "userId").
3. NEVER change field types unless the user EXPLICITLY asks to change them.
4. When adding a new resource that references an existing one, use the same FK naming convention already present in the schema (e.g. if existing FKs use "author_id" style, use "book_id" not "bookId").
</critical_rules>

<output_format>
Return a single JSON object with exactly two fields:
- "resources": an object where each key is a resource name and each value is an array of 5 sample data items. Include ALL resources (existing + new).
- "changes": an array of short strings describing each change made.

Every data item must have an "id" field (auto-incrementing integer starting from 1). Generate realistic English sample data.
</output_format>

<examples>
<example>
User: "Add an email field to users"
Current: users has fields id, name, age

Correct response: resources includes "users" with id, name, age, AND email. All other resources unchanged.
Wrong: Removing age field. Renaming name to username. Omitting other resources.
</example>

<example>
User: "Add a categories resource"
Current: users, posts, comments

Correct response: resources includes users, posts, comments (unchanged), AND categories (new).
Wrong: Returning only categories. Omitting users, posts, or comments.
</example>
</examples>

Return ONLY valid JSON. No explanation, no markdown, no code blocks.`,
    messages: [{ role: 'user', content: message }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = JSON.parse(extractJson(text));

  if (!parsed.resources || !parsed.changes) {
    throw new Error('AI returned invalid format: expected { resources, changes }');
  }

  return parsed as { resources: Record<string, unknown[]>; changes: string[] };
}
