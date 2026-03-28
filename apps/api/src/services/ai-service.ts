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
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are an API schema designer. Given a natural language description, generate a JSON object with realistic sample data.

Rules:
- Top-level keys are resource names (plural, lowercase, English)
- Each resource is an array of 10 realistic items
- Each item must have an "id" field (auto-incrementing integer starting from 1)
- Generate contextually realistic data (Korean names if Korean context is mentioned, valid emails, realistic ages 20-60, proper phone formats, etc.)
- If the user mentions relationships between resources, use matching foreign key ids
- Return ONLY valid JSON, no explanation or markdown`,
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
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are a realistic data generator. Given a schema and sample data, generate more items that match the same pattern and style.

Rules:
- Match the exact field names and types from the schema
- Start id from ${maxId + 1} and auto-increment
- Generate contextually realistic data that matches the existing data's language and style
- If existing data uses Korean names, generate Korean names. If English, use English.
- Emails should be valid-looking, ages realistic (20-60), dates in ISO format
- Return ONLY a valid JSON array, no explanation or markdown`,
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

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are an API schema modifier. You receive a current API schema and a user's modification request.

Current schema:
${schemaDescription}

Rules:
- Return a JSON object with two fields: "resources" and "changes"
- "resources" contains the COMPLETE updated schema with sample data (5 items per resource)
- Include ALL resources (both modified and unmodified ones)
- Each resource is a key with an array of sample data items
- Every item must have an "id" field (auto-incrementing integer)
- Preserve existing field names unless the user explicitly asks to rename/remove them
- Generate realistic sample data matching the field names
- "changes" is an array of human-readable strings describing what was modified
- Return ONLY valid JSON, no explanation or markdown`,
    messages: [{ role: 'user', content: message }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = JSON.parse(extractJson(text));

  if (!parsed.resources || !parsed.changes) {
    throw new Error('AI returned invalid format: expected { resources, changes }');
  }

  return parsed as { resources: Record<string, unknown[]>; changes: string[] };
}
