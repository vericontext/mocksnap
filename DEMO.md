# MockSnap Demo Guide

**Live demo:** [mocksnap.dev](https://mocksnap.dev) | **API:** [api.mocksnap.dev](https://api.mocksnap.dev/health)

> Describe your API in words — get live REST + GraphQL endpoints with docs, ER diagrams, and production features in seconds.

---

## Demo 1: One Sentence to a Full API (30s)

No JSON, no config. Just describe what you want.

1. Go to [mocksnap.dev](https://mocksnap.dev) → "Natural Language" tab
2. Type:
```
Online bookstore API. Authors, books, reviews, users.
Books linked to authors, reviews linked to books and users.
5 items of realistic data each.
```
3. "Generate API" → **3 seconds later you have:**

| What you get | URL |
|-------------|-----|
| Swagger API docs | `/m/{id}/docs` — browse endpoints, try requests |
| REST endpoints | `/m/{id}/books` — full CRUD |
| GraphQL | `/m/{id}/graphql` — nested relation queries |
| ER diagram | Dashboard — visual schema with FK relationships |

AI designs the schema, picks the right fields (title, isbn, price, rating...), creates FK relationships, and fills in realistic data.

> Requires Anthropic API key (BYOK — your key, stored in browser only)

---

## Demo 2: No API Key? No Problem (15s)

Paste a single JSON item. Faker.js generates realistic data from field names alone.

```json
{ "users": [{ "id": 1, "name": "", "email": "", "phone": "", "age": 0 }] }
```

→ Faker detects: `name` → full names, `email` → valid emails, `phone` → phone numbers, `age` → 18-65

**Then amplify:** click the "Amplify" button on the dashboard → generate 50, 100, or 1000 items instantly. No AI key needed.

---

## Demo 3: Iterate with Chat — No Restart Needed (20s)

Created a mock but need changes? Use the chat panel on the dashboard:

```
You: "Add a tags resource linked to books, and add a publishedAt date field to books"
```

MockSnap applies changes instantly:
- ✓ New `tags` resource created with bookId FK
- ✓ `publishedAt` field added to books
- ✓ Data regenerated for all modified resources
- ✓ ER diagram, endpoints, API docs, GraphQL schema — all refreshed

More examples:
```
"Add an email field to users"
"Create an orders resource with userId, productId, quantity, and status"
"Remove the comments resource"
```

---

## Demo 4: Amplify Data to Any Scale (10s)

Start with 5 AI-generated items, then scale up with Faker:

```bash
# 5 items from AI creation
GET /m/{id}/users → 5 users

# Amplify to 100 — instant, no AI key
POST /api/mocks/{id}/amplify
{"resource": "users", "count": 100}
→ 105 users total, all with realistic names/emails/ages

# Amplify all resources at once
POST /api/mocks/{id}/amplify
{"count": 200}
→ 200 more items per resource
```

On the dashboard: each resource has an Amplify button with count input.

---

## Demo 5: Query Like Stripe's API (30s)

Every query feature a frontend developer needs:

```bash
# Filtering
GET /books?price_gte=15&genre=fiction

# Sorting
GET /books?sort=price&order=desc

# Cursor pagination (Stripe-style)
GET /books?limit=3
→ { "data": [...], "has_more": true, "next_cursor": "eyJpZCI6M30=" }
GET /books?cursor=eyJpZCI6M30=&limit=3

# Full-text search
GET /books?q=gatsby

# Field selection
GET /books?fields=id,title,price

# Relations — expand FK to full object
GET /books?_expand=author
→ { "title": "The Great Gatsby", "author": { "name": "F. Scott Fitzgerald" } }

# Deep relations — 3 levels
GET /authors/1?_embed=books,books.reviews

# Nested resources
GET /users/1/posts
```

Enable envelope mode for `{ data, meta, links }` wrapping with RFC 7807 errors.

---

## Demo 6: Production Scenario Testing (30s)

Test edge cases your frontend needs to handle. All configured from the **dashboard → Settings button** on each resource.

### Auth simulation

1. Dashboard → `/users` resource → **Settings** → set Auth to Bearer with key `my-secret` → **Save Config**
2. Now API calls without the token get rejected:
   - `GET /users` → 401 Unauthorized
   - `GET /users` with `Authorization: Bearer my-secret` → 200 OK
3. Test your login flow, protected routes, and permission-based UI.

### Error & latency simulation

1. Dashboard → Settings → set **Error rate** to 50%, **Error status** to 503, **Delay** to 2000ms → Save
2. API responses: half succeed after 2 seconds, half return 503
3. Test your loading spinners, retry logic, and error boundaries.

### Idempotency & caching

Use the **API Playground** on the dashboard:

- Send same POST with `Idempotency-Key: abc` twice → only 1 item created
- Send GET → note the **ETag** header → send again with `If-None-Match` → 304 Not Modified
- Test your React Query / SWR cache revalidation logic.

---

## Demo 7: GraphQL Playground (15s)

Every mock gets a built-in **GraphiQL IDE** — no setup needed.

1. On the dashboard, click the **GraphQL URL** (e.g. `https://api.mocksnap.dev/m/{id}/graphql`)
2. GraphiQL opens in your browser with auto-complete and docs
3. Try a nested query:

```graphql
{
  authors {
    name
    books {
      title
      reviews {
        rating
        comment
        user { name }
      }
    }
  }
}
```

FK fields (`authorId`, `bookId`, `userId`) are auto-detected → relation types generated automatically. REST and GraphQL share the same data.

---

## Demo 8: Auto-generated Docs + ER Diagram (15s)

Every mock instantly gets:

**Scalar API Docs** at `/m/{id}/docs`:
- Interactive "Test Request" button
- All query parameters documented
- Client code in Shell, Node.js, Python, Ruby, PHP
- OpenAPI 3.0 spec download

**Mermaid ER Diagram** on dashboard:
- FK auto-detection with PK/FK labels
- Relationship lines (has many)
- Light/Dark theme support

---

## Demo 9: Reset, MCP, and Testing (15s)

```bash
# Reset to original data after test pollution
POST /api/mocks/{id}/reset → seed data restored

# Run tests
pnpm --filter @mocksnap/api test → 50 tests, <1 second
```

**MCP for Claude Code / Cursor:**
```
"Create an online bookstore Mock API"
→ MCP auto-calls create_mock → returns endpoints → fetch() ready
```

---

## Why MockSnap?

| Before | After |
|--------|-------|
| Hardcoded JSON files | Live stateful API with auto timestamps |
| json-server config | One sentence: "Create a bookstore API" |
| Writing MSW handlers | Zero code — just describe and generate |
| Recreating mock for changes | Chat: "Add ratings to books" → instant |
| Separate API docs | Auto-generated Swagger UI + ER diagram |
| REST or GraphQL (pick one) | Both generated simultaneously |
| Basic mock with no queries | Filter, sort, paginate, cursor, relations |
| Can't test error scenarios | Auth, delays, error rates, ETag, idempotency |
| Data pollution after tests | `POST /reset` — one line |
| AI key required for data | Faker.js generates 1000 items without a key |
| 5 items from AI | Amplify to 100+ with one click |

**When backend is ready:** change `api.mocksnap.dev/m/abc123` → `api.yourapp.com`. Done.
