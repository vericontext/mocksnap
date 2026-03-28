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
