# MockSnap

> Paste JSON, describe in words, or drop an OpenAPI spec — get a live REST + GraphQL API with docs in seconds.

**Live Demo:** [mocksnap.dev](https://mocksnap.dev) | **API:** [api.mocksnap.dev](https://api.mocksnap.dev/health) | **GitHub:** [vericontext/mocksnap](https://github.com/vericontext/mocksnap)

MockSnap is an AI-powered Mock API generator for frontend-backend decoupling. Provide a JSON sample, natural language prompt, or OpenAPI spec — and get a live API instantly. No signup, no setup.

## Demo

https://github.com/user-attachments/assets/8d01bf64-536d-4867-b004-8f2b091fed3c

## Features

### 3 Input Modes

- **JSON** — Paste sample data -> auto-infer schema
- **Natural Language** — `"User CRUD API + order list with realistic data"` -> AI generates schema + data
- **OpenAPI Spec** — OpenAPI 3.x JSON/YAML -> realistic data generation based on schema

### Iterative Modification via Chat

Refine your API without starting over. On the dashboard, describe what to change:

```
"Add a reviews resource linked to products"
"Add an email field to users"
"Remove the tags resource"
```

ER diagram, endpoints, API docs, and GraphQL schema update instantly.

### REST + GraphQL Generated Simultaneously

Both endpoints are auto-generated from the same schema.

```
REST:    http://localhost:3001/m/{mockId}/users
GraphQL: http://localhost:3001/m/{mockId}/graphql
```

### AI-Powered Realistic Data

Leverages Claude API to generate context-aware data.
- Realistic names, ages (20~60), valid emails, phone numbers, etc.
- JSON input: seed 1~2 items -> auto-amplify to 10 items

### Stateful CRUD

Data created via POST is reflected in GET responses. SQLite persists the data.

```bash
POST /m/{id}/users  {"name":"Alex"}   # Create
GET  /m/{id}/users                    # Returns including Alex
```

### Response Customization

Simulate edge cases per resource.

| Setting | Description |
|---------|-------------|
| Delay | Response delay (ms) |
| Error Rate | Random error probability (0~100%) |
| Error Status | HTTP status code on error (400, 500, 503, etc.) |
| Force Status | Force all responses to a specific status code |

### Webhook Simulation

Set a webhook URL on a resource, and event payloads are automatically sent on CRUD operations.

```json
{ "event": "created", "resource": "users", "data": {...}, "timestamp": "..." }
```

### Request Logs

All requests/responses to the Mock API are recorded. Viewable in real-time on the dashboard.

### MCP Server

Create and manage Mock APIs directly from Claude Code, Cursor, etc.

```bash
# Register with Claude Code
claude mcp add mocksnap -- npx tsx /path/to/apps/api/src/mcp-server.ts

# Then in Claude Code:
# "Create a user CRUD API" -> auto-calls create_mock tool
```

MCP tools: `create_mock`, `list_mocks`, `get_mock`, `delete_mock`

## Quick Start

### Requirements

- Node.js 20+
- pnpm 10+

### Install & Run

```bash
git clone https://github.com/vericontext/mocksnap.git
cd mocksnap
pnpm install

# For AI features (optional)
echo "ANTHROPIC_API_KEY=sk-ant-..." > apps/api/.env

# Run
pnpm dev
```

- Web UI: http://localhost:3000
- API: http://localhost:3001

### Quick Test (CLI)

```bash
# Create Mock with JSON
curl -X POST http://localhost:3001/api/mocks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API",
    "sample": {
      "users": [{"id": 1, "name": "Alex", "email": "alex@test.com"}],
      "posts": [{"id": 1, "title": "Hello", "userId": 1}]
    }
  }'

# Create Mock with natural language (requires ANTHROPIC_API_KEY)
curl -X POST http://localhost:3001/api/mocks \
  -H "Content-Type: application/json" \
  -d '{"name": "E-commerce", "prompt": "Users, products, and orders API with realistic data"}'

# GraphQL query
curl -X POST http://localhost:3001/m/{mockId}/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ users { id name email } }"}'
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | pnpm workspace + Turborepo |
| Frontend | Next.js 15 (App Router) + Tailwind CSS 4 |
| Backend | Hono + Node.js |
| AI | Claude API (Anthropic SDK) |
| GraphQL | graphql-yoga |
| Database | SQLite (better-sqlite3) |
| MCP | @modelcontextprotocol/sdk |

## Project Structure

```
mocksnap/
├── apps/
│   ├── api/                    # Hono backend (port 3001)
│   │   └── src/
│   │       ├── index.ts        # HTTP server entry point
│   │       ├── mcp-server.ts   # MCP server entry point
│   │       ├── db/             # SQLite connection, schema, dynamic tables
│   │       ├── routes/         # REST CRUD, GraphQL, Config, logs
│   │       └── services/       # Schema inference, AI, OpenAPI parser, GraphQL builder
│   └── web/                    # Next.js frontend (port 3000)
│       ├── app/                # Pages (landing, Mock dashboard, list)
│       ├── components/         # JSON input, endpoint list, playground, logs
│       └── lib/                # API client
└── packages/
    └── shared/                 # Shared types and constants
```

## API Reference

### Mock Management

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/mocks` | Create Mock (JSON/prompt/OpenAPI) |
| GET | `/api/mocks` | List all Mocks |
| GET | `/api/mocks/:id` | Mock details |
| DELETE | `/api/mocks/:id` | Delete Mock |
| GET | `/api/mocks/:id/logs` | Request logs (last 100) |
| PATCH | `/api/mocks/:id/resources/:name/config` | Update resource config |

### Dynamic Mock API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/m/:mockId/:resource` | List all |
| GET | `/m/:mockId/:resource/:id` | Get single |
| POST | `/m/:mockId/:resource` | Create |
| PUT | `/m/:mockId/:resource/:id` | Full update |
| PATCH | `/m/:mockId/:resource/:id` | Partial update |
| DELETE | `/m/:mockId/:resource/:id` | Delete |
| POST | `/m/:mockId/graphql` | GraphQL query/mutation |

## Roadmap

### Make it work like a real API

- [x] **Filtering** — `GET /users?age_gte=20&age_lte=30&category=laptop`
- [x] **Sorting** — `GET /users?sort=name&order=asc`
- [x] **Pagination** — `GET /users?page=2&limit=10` (includes total count header)
- [x] **Full-text search** — `GET /users?q=kim`
- [x] **Nested resources** — `GET /users/1/posts` (user 1's posts)
- [x] **Relation expansion** — `GET /posts?_expand=author&_embed=comments`
- [x] **Deep relations** — `?_expand=post,post.user` multi-level dot notation (max 3 levels)
- [x] **GraphQL relation types** — Auto-detect FK, `{ users { posts { comments { user } } } }`
- [x] **Auth simulation** — API Key, Bearer Token validation

### Production-grade Mock (High Priority)

- [x] **ETag + 304** — Conditional requests (`If-None-Match` -> `304 Not Modified`), React Query/SWR cache testing
- [x] **Data reset** — `POST /api/mocks/:id/reset` restores seed data, essential for E2E testing
- [x] **Auto timestamp** — `createdAt` on POST, `updatedAt` on PATCH auto-injected
- [x] **Cursor-based pagination** — `?cursor=xxx&limit=10`, Stripe/Shopify standard
- [x] **Faker.js smart data** — Detects meaning from field names (email->email, phone->phone number)
- [x] **Idempotency Key** — `Idempotency-Key` header prevents duplicate requests (Stripe pattern)
- [x] **Webhook HMAC signing** — `X-MockSnap-Signature` HMAC-SHA256 verification header
- [x] **Delay distribution** — Supports uniform/normal distribution in addition to fixed delay

### Platform Expansion

- [ ] Record & Replay — Record production API proxy -> auto-generate Mock
- [ ] Team Workspace — Team workspaces + Mock version control
- [ ] Cloud Deployment — Cloudflare Workers edge hosting
- [ ] Custom Domain — Wildcard subdomain (`abc123.mocksnap.dev`)
- [ ] Monaco Editor — Schema editor integration
- [ ] SDK/CLI — `npx mocksnap create "user API"`
- [ ] SQL DDL Input — Auto-generate Mock from `CREATE TABLE` statements
- [x] OpenAPI Reverse Generation — Mock -> OpenAPI 3.x spec + Scalar API Docs UI
- [ ] SSE/Streaming — `text/event-stream` real-time endpoint

## Changelog

### v1.1.0 (2026-03-28) — Iterative Chat Modification

- **Modify API via chat:** describe changes in natural language on the dashboard
- Add/remove resources, add/rename fields, regenerate data — all via chat
- ER diagram, endpoints, API docs, and GraphQL schema auto-refresh after modification
- `POST /api/mocks/:mockId/chat` endpoint

### v1.0.0 (2026-03-28) — Public Launch

- **Live demo:** [mocksnap.dev](https://mocksnap.dev) deployed (Vercel + Fly.io)
- "Try it now" one-click demo button — instant Blog API with no setup
- Mermaid ER diagram auto-generated on dashboard (FK auto-detection, light/dark theme)
- Light/Dark mode toggle (default: light, saved to localStorage)
- All UI and docs translated to English for global audience
- Custom domains: `mocksnap.dev` (frontend) + `api.mocksnap.dev` (API)

### v0.9.0 (2026-03-28) — Auto-generated API Docs

- `/m/:mockId/docs` — Auto-generated Scalar API Reference UI (replaces Swagger UI)
- `/m/:mockId/openapi.json` — Auto-generated OpenAPI 3.0 spec
- Added "Docs" link to dashboard

### v0.8.0 (2026-03-28) — Deep Relation Queries

- Deep expand: `?_expand=post,post.user` — multi-level relation expansion (max 3 levels)
- Deep embed: `?_embed=posts,posts.comments` — multi-level relation embedding
- GraphQL relation types: auto-detect FK to create relation fields between types (`User.posts`, `Post.user`)
- GraphQL nested queries: `{ users { posts { comments { user { name } } } } }`

### v0.7.0 (2026-03-28) — Production API Patterns

- Auth simulation: API Key (`X-API-Key`) / Bearer Token validation, 401 response
- Cursor-based pagination: `?cursor=xxx&limit=10` -> `{ data, has_more, next_cursor }` (Stripe pattern)
- Webhook HMAC signing: `X-MockSnap-Signature` + `X-MockSnap-Timestamp` headers
- Delay distribution: fixed (ms), uniform (min~max), normal (mean +/- sigma) support
- Idempotency Key: `Idempotency-Key` header prevents duplicate POSTs (24-hour caching)
- Faker.js smart data: auto-generates realistic data by detecting field names, even without AI key

### v0.6.0 (2026-03-28) — Cache, Reset, Timestamps

- ETag + `304 Not Modified`: ETag hash on GET responses, returns 304 on `If-None-Match` match
- Data reset: `POST /api/mocks/:id/reset` — restores to seed data snapshot
- Auto timestamp: `createdAt`/`updatedAt` on POST, `updatedAt` on PUT/PATCH auto-injected

### v0.5.0 (2026-03-28) — Production-grade Responses

- Response Envelope: `{ data, meta, links }` wrapping (per-resource on/off)
- RFC 7807 Problem Details error format (`type`, `title`, `status`, `detail`, `instance`)
- Field selection: `?fields=id,name` — return only specified fields
- `Location` header: resource URL in POST 201 response
- Rate Limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- `Link` header: RFC 8288 standard pagination (`rel="next"`, `rel="last"`, etc.)

### v0.4.0 (2026-03-28) — Works Like a Real API

- Filtering: `?age_gte=20&age_lte=30`, `?name=Alex`, `?status_ne=deleted`, `?name_like=alex`
- Sorting: `?sort=name&order=asc`
- Pagination: `?page=2&limit=10` + `X-Total-Count` response header
- Full-text search: `?q=kim`
- Nested resources: `/users/1/posts` (auto FK detection)
- Relation expansion: `?_expand=user` (FK -> replaced with original object)
- Relation embedding: `?_embed=posts` (1:N child resource array included)

### v0.3.0 (2026-03-28) — Deployment Ready

- BYOK (Bring Your Own Key): Users use their own Anthropic API key for AI features
- Rate limit: 10 Mock creations per hour per IP
- Mock TTL: 7-day auto-expiration + periodic cleanup
- Fly.io deployment setup (Dockerfile + fly.toml + persistent volume)
- Vercel frontend deployment setup

### v0.2.0 (2026-03-28) — Extended Features

- Auto-generated GraphQL endpoint (REST + GraphQL simultaneously from same schema)
- MCP server — Create/manage Mocks directly from Claude Code/Cursor
- Webhook simulation (sends event payload to configured URL on CRUD operations)
- Request logs (records all requests/responses + real-time dashboard display)

### v0.1.0 (2026-03-28) — MVP

- JSON sample input -> auto-generate REST API + Stateful CRUD
- AI natural language input -> auto-generate schema + realistic data (Claude API)
- AI data amplification (seed 1~2 items -> 10 realistic data items)
- OpenAPI 3.x spec input (JSON/YAML)
- Response customization (delay, error rate, status code, forced status)
- Mock list management page
- Web UI (Next.js) + API Playground

## License

MIT
