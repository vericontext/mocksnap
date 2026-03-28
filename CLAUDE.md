# MockSnap

AI-powered Mock API generator. JSON / natural language / OpenAPI input -> instantly generate REST + GraphQL APIs.

## Project Structure

pnpm workspace + Turborepo monorepo.

- `apps/api` — Hono backend (port 3001), ESM (`"type": "module"`)
- `apps/web` — Next.js 15 App Router frontend (port 3000), Tailwind CSS 4
- `packages/shared` — Shared TypeScript types and constants

## Build & Run

```bash
pnpm install                      # Install dependencies
pnpm dev                          # Run all (turborepo -> api + web simultaneously)
pnpm --filter @mocksnap/api dev   # Run API only
pnpm --filter @mocksnap/web dev   # Run Web only
pnpm --filter @mocksnap/api mcp   # MCP server (STDIO)
```

## Coding Conventions

- TypeScript strict mode, ESM (`import/export`)
- Backend import paths must include `.js` extension (ESM rule): `import { db } from './connection.js'`
- shared package references source directly without build (`"main": "./src/index.ts"`)
- When adding new types, define them in `packages/shared/src/types.ts` and re-export from `index.ts`
- Hono routes are split by file in `apps/api/src/routes/`, mounted via `app.route()` in `index.ts`
- Frontend components are split by file in `apps/web/components/`, `'use client'` required
- Styling uses Tailwind CSS utility classes only (no separate CSS files)

## Architecture Overview

### Data Flow

```
Input(JSON/prompt/OpenAPI) -> mock-service.ts -> inferSchema() or AI -> DB save -> dynamic routing
```

### DB (SQLite)

- Single file: `apps/api/data/mocksnap.db` (gitignored)
- Meta tables: `mocks`, `mock_resources`, `request_logs`
- Dynamic data tables: `mock_{mockId}_{resource}` — each row stores JSON blob in `data` column
- Queries: filter/sort/search via `json_extract(data, '$.field')`
- WAL mode enabled

### Core Services (apps/api/src/services/)

- `mock-service.ts` — Mock CRUD orchestration (createMock, getMock, listMocks, deleteMock)
- `schema-inferrer.ts` — JSON -> resource/field inference + Faker.js smart data generation (`generateFakerData`)
- `ai-service.ts` — Claude API integration (generateFromPrompt, amplifyData). Requires ANTHROPIC_API_KEY env var
- `openapi-parser.ts` — OpenAPI 3.x JSON/YAML -> resource parsing
- `graphql-schema.ts` — Dynamic SDL + resolver build, auto-detect FK for relationship fields (belongsTo/hasMany)

### Routes (apps/api/src/routes/)

- `mocks.ts` — `POST/GET/DELETE /api/mocks`, `GET /api/mocks/:id/logs`, `POST /api/mocks/:id/reset`
- `dynamic.ts` — `ALL /m/:mockId/:resource/:id?` (REST CRUD + queries + relations + logging + webhook)
- `graphql.ts` — `ALL /m/:mockId/graphql` (graphql-yoga)
- `config.ts` — `GET/PATCH /api/mocks/:id/resources/:name/config`

### Entry Points

- `apps/api/src/index.ts` — HTTP server (Hono + @hono/node-server)
- `apps/api/src/mcp-server.ts` — MCP server (STDIO, @modelcontextprotocol/sdk)

## Testing

No test framework adopted yet. Manual verification via curl:

```bash
# Create Mock
curl -X POST http://localhost:3001/api/mocks \
  -H "Content-Type: application/json" \
  -d '{"name":"test","sample":{"users":[{"id":1,"name":"Kim"}]},"amplify":false}'

# Verify CRUD
curl http://localhost:3001/m/{mockId}/users

# GraphQL
curl -X POST http://localhost:3001/m/{mockId}/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ users { id name } }"}'
```

## Important Notes

- `better-sqlite3` requires native build — build is approved during `pnpm install` (`pnpm.onlyBuiltDependencies`)
- Without Bun installed: using `@hono/node-server` + `tsx watch` as Node.js fallback
- AI features require BYOK (user key) or server `ANTHROPIC_API_KEY`. If neither is available, AI is disabled; JSON input still works normally
- Dynamic route queries: `?field_gte=`, `?sort=&order=`, `?page=&limit=`, `?cursor=`, `?q=`, `?fields=`, `?_expand=`, `?_embed=`
- Relation dot notation: `?_expand=post,post.user` (max 3 levels). FK auto-detected via `{singular}Id` pattern
- Nested resources: `/resource/:id/subResource` — auto-filter based on FK
- Response format: when `ResourceConfig.envelope=true`, wraps in `{ data, meta, links }`; errors use RFC 7807
- ETag: GET responses include MD5 hash ETag, `If-None-Match` -> 304. POST/PUT/PATCH auto-inject `createdAt`/`updatedAt`
- Auth: when `ResourceConfig.auth` is set, validates `X-API-Key` or `Authorization: Bearer`
- Idempotency: `Idempotency-Key` header prevents duplicate POSTs (24-hour in-memory cache)
- Faker fallback: without AI key, `@faker-js/faker` auto-generates realistic data based on field names
- Dynamic table names only allow alphanumeric + underscore via `sanitizeName()` to prevent SQL injection
- `.env` file is located at `apps/api/.env`, gitignored
- Deployment: Dockerfile (`apps/api/Dockerfile`) + fly.toml (Fly.io), vercel.json (Vercel)
