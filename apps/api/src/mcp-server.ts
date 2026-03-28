import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initializeSchema } from './db/schema.js';
import { createMock, getMock, listMocks, deleteMock } from './services/mock-service.js';
import { API_BASE_URL } from '@mocksnap/shared';

// Initialize database
initializeSchema();

const server = new McpServer({
  name: 'MockSnap',
  version: '0.2.0',
});

// Tool: create_mock
server.tool(
  'create_mock',
  'Create a mock REST API from JSON sample, natural language prompt, or OpenAPI spec. Returns live API endpoints.',
  {
    name: z.string().optional().describe('Name for the mock API'),
    source_type: z.enum(['json', 'prompt', 'openapi']).describe('Input type: "json" for JSON sample data, "prompt" for natural language description, "openapi" for OpenAPI 3.x spec'),
    source: z.string().describe('The input content. For json: a JSON object with resources as keys (e.g. {"users":[...]}). For prompt: natural language like "User CRUD API with Korean data". For openapi: OpenAPI 3.x spec in JSON or YAML.'),
    amplify: z.boolean().optional().describe('Whether to use AI to expand seed data to ~10 items per resource (default: true for json mode)'),
  },
  async ({ name, source_type, source, amplify }) => {
    try {
      let request: Parameters<typeof createMock>[0];

      if (source_type === 'json') {
        const parsed = JSON.parse(source);
        request = { name, sample: parsed, amplify };
      } else if (source_type === 'prompt') {
        request = { name, prompt: source };
      } else {
        request = { name, openapi: source };
      }

      const mock = await createMock(request);

      const endpointSummary = mock.resources.map((r) =>
        `  ${r.name} (${r.count} items): ${Object.values(r.endpoints).join(', ')}`
      ).join('\n');

      return {
        content: [{
          type: 'text' as const,
          text: `Mock API created successfully!\n\nID: ${mock.id}\nName: ${mock.name || '(unnamed)'}\nBase URL: ${mock.baseUrl}\n\nResources:\n${endpointSummary}\n\nThe API is live and ready to use. Make HTTP requests to the endpoints above.\nThe API server must be running: pnpm --filter @mocksnap/api dev`,
        }],
      };
    } catch (e) {
      return {
        content: [{
          type: 'text' as const,
          text: `Failed to create mock: ${e instanceof Error ? e.message : String(e)}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool: list_mocks
server.tool(
  'list_mocks',
  'List all existing mock APIs with their IDs, names, and base URLs.',
  {},
  async () => {
    const mocks = listMocks();
    if (mocks.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No mock APIs found. Use create_mock to create one.' }],
      };
    }

    const list = mocks.map((m) =>
      `- ${m.name || '(unnamed)'} [${m.id}] — ${m.resourceCount} resources — ${m.baseUrl}`
    ).join('\n');

    return {
      content: [{ type: 'text' as const, text: `Found ${mocks.length} mock API(s):\n\n${list}` }],
    };
  }
);

// Tool: get_mock
server.tool(
  'get_mock',
  'Get detailed information about a specific mock API including resources, fields, and endpoints.',
  {
    mock_id: z.string().describe('The ID of the mock API to retrieve'),
  },
  async ({ mock_id }) => {
    const mock = getMock(mock_id);
    if (!mock) {
      return {
        content: [{ type: 'text' as const, text: `Mock API "${mock_id}" not found.` }],
        isError: true,
      };
    }

    const details = mock.resources.map((r) => {
      const fields = r.fields.map((f) => `${f.name}: ${f.type}${f.nullable ? '?' : ''}`).join(', ');
      const endpoints = Object.entries(r.endpoints).map(([k, v]) => `    ${k}: ${v}`).join('\n');
      return `  ${r.name}\n    Fields: ${fields}\n${endpoints}`;
    }).join('\n\n');

    return {
      content: [{
        type: 'text' as const,
        text: `Mock API: ${mock.name || '(unnamed)'}\nID: ${mock.id}\nBase URL: ${mock.baseUrl}\nCreated: ${mock.createdAt}\n\nResources:\n${details}`,
      }],
    };
  }
);

// Tool: delete_mock
server.tool(
  'delete_mock',
  'Delete a mock API and all its data.',
  {
    mock_id: z.string().describe('The ID of the mock API to delete'),
  },
  async ({ mock_id }) => {
    const deleted = deleteMock(mock_id);
    if (!deleted) {
      return {
        content: [{ type: 'text' as const, text: `Mock API "${mock_id}" not found.` }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text' as const, text: `Mock API "${mock_id}" has been deleted.` }],
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('MCP server error:', error);
  process.exit(1);
});
