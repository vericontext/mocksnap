# MockSnap Demo Guide

## One-line Summary

> "Develop your frontend without a backend. Just say a word and get a complete API with docs."

---

## Demo 1: Describe It and Get an API (30 seconds)

**No JSON needed.** Just describe what you want.

### 1. Go to http://localhost:3000 -> Click "Natural Language" tab

### 2. Describe the API you want in natural language

```
Online bookstore API. Authors, books, reviews, users.
Books linked to authors, reviews linked to books and users.
5 items of realistic data each.
```

### 3. Click "Generate API" -> Done in 3 seconds

What AI generates:
- **API structure** — 4 resources: authors, books, reviews, users
- **Field design** — Meaningful fields like title, price, isbn, rating, birth_year
- **Relationships** — `books.author_id -> authors`, `reviews.book_id -> books`
- **Realistic data** — Actual literature data with real author names and book titles

### 4. Instantly available

| URL | Description |
|-----|-------------|
| `/m/{id}/docs` | API documentation (Scalar UI) — Test directly with Try it out button |
| `/m/{id}/books` | REST API — Call with curl or fetch() |
| `/m/{id}/graphql` | GraphQL — Fetch relations in a single query |
| Dashboard | ER diagram — Visualize relationship structure |

> Anthropic API Key required — Expand "Anthropic API Key" at the top of the page and enter your key

---

## Demo 2: Just 1 JSON Item, No API Key Needed (15 seconds)

No API key required. Just provide one JSON item and Faker.js fills in the rest.

### 1. Enter minimal structure in the "JSON" tab

```json
{
  "users": [
    { "id": 1, "name": "", "email": "", "phone": "", "age": 0 }
  ]
}
```

### 2. "Generate API" -> Faker.js auto-generates realistic data based on field names

```json
[
  { "id": 1, "name": "", "email": "", "phone": "", "age": 0 },
  { "id": 2, "name": "Lucille Schinner", "email": "Gaston_Turner13@gmail.com", "phone": "(975) 591-4320", "age": 32 },
  { "id": 3, "name": "Joy Haley-Bruen", "email": "Chance.Kling96@gmail.com", "phone": "(910) 702-8061", "age": 28 }
]
```

`name` -> name, `email` -> email, `phone` -> phone number... It automatically fills data just by looking at field names.

### 3. POST is reflected in GET (Stateful)

```bash
curl -X POST .../users -H "Content-Type: application/json" \
  -d '{"name": "New User", "email": "new@test.com"}'
# -> createdAt, updatedAt auto-added

curl .../users  # -> Includes new user
```

---

## Demo 3: Auto-generated API Docs + ER Diagram (15 seconds)

When you create a Mock, two things are **instantly** auto-generated.

### Swagger UI (Scalar)

Go to `http://localhost:3001/m/{mockId}/docs` ->

- All endpoint listing (GET, POST, PUT, PATCH, DELETE)
- Query parameter documentation (sort, page, cursor, _expand...)
- "Test Request" button to call APIs directly from the browser
- OpenAPI spec download (`/openapi.json`)
- Auto-generated client code for Shell, Node.js, Python, Ruby, etc.

### ER Diagram

Mermaid ER diagram auto-renders at the top of the dashboard:

```
authors ---- has many ---- books ---- has many ---- reviews
                                                      |
users ------------------ has many -------------------+
```

FK fields (`author_id`, `book_id`, `user_id`) are auto-detected. Theme switches to match Light/Dark mode.

---

## Demo 4: Query Like a Real API (30 seconds)

Ready to use directly in your frontend code.

```bash
# Filtering — Only books priced above $15 in the fiction genre
curl ".../books?price_gte=15000&genre=fiction"

# Sorting — Most expensive first
curl ".../books?sort=price&order=desc"

# Pagination (Stripe-style cursor)
curl ".../books?limit=3"
# -> { "data": [...], "has_more": true, "next_cursor": "eyJpZCI6M30=" }
curl ".../books?cursor=eyJpZCI6M30=&limit=3"

# Search
curl ".../books?q=vegetarian"

# Field selection — Only the fields you need
curl ".../books?fields=id,title,price"

# Relation expansion — Include author info with books
curl ".../books?_expand=author"
# -> { "title": "The Vegetarian", "author": { "name": "Han Kang" } }

# Deep relations — Authors -> Books -> Reviews (3 levels)
curl ".../authors/1?_embed=books,books.reviews"
```

> Enable Envelope mode for `{ data, meta: { total, page }, links: { next, prev } }` wrapping. RFC 7807 error format.

---

## Demo 5: Production Scenarios (30 seconds)

### Authentication

```bash
# Set Bearer Token -> 401 without token
curl -X PATCH ".../config" -d '{"auth":{"type":"bearer","key":"my-secret"}}'
curl .../books                                        # -> 401 Unauthorized
curl -H "Authorization: Bearer my-secret" .../books   # -> 200
```

### Simulating Unstable APIs

```bash
# 50% chance of 503 error + 1~3 second random delay
curl -X PATCH ".../config" -d '{
  "errorRate": 0.5, "errorStatus": 503,
  "delay": {"type":"uniform","min":1000,"max":3000}
}'
```

### Duplicate Prevention & Caching

```bash
# Idempotency Key — POST twice with same key -> only 1 item created
curl -H "Idempotency-Key: order-1" -X POST .../orders -d '{"item":"MacBook"}'
curl -H "Idempotency-Key: order-1" -X POST .../orders -d '{"item":"MacBook"}'
# -> Second returns cached response, no duplicates

# ETag — 304 if data hasn't changed (React Query/SWR cache testing)
curl -v .../books                                     # -> ETag: "a1b2c3..."
curl -H 'If-None-Match: "a1b2c3..."' .../books        # -> 304 Not Modified
```

---

## Demo 6: GraphQL — Complex Relations in a Single Query (15 seconds)

FK is auto-detected to create relation types. No configuration needed:

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

```
-> Author A
    Book Title 1
      *5 "A masterpiece of imagination" — User 1
  Author B
    Book Title 2
      *4 "Intense and thought-provoking" — User 2
```

---

## Demo 7: Iterate on Your API with Chat (20 seconds)

Created a mock but need to change it? Just tell it what to modify — no need to start over.

### On the dashboard, use the "Modify API" chat panel:

```
You: "Add a tags resource linked to posts, and add a publishedAt date field to posts"
```

MockSnap AI applies the changes:
- Created `tags` resource with id, name fields
- Added `postId` FK linking tags to posts
- Added `publishedAt` field to posts
- Regenerated sample data for all modified resources

**Everything updates instantly** — ER diagram, endpoints, API docs, GraphQL schema.

### More examples:

```
"Add an avatar URL field to users"
"Create an orders resource with userId, productId, quantity, and status"
"Remove the comments resource"
"Add a price field to products and make it a number"
```

> Requires Anthropic API key. Each modification re-generates data to match the new schema.

---

## Demo 8: Data Reset + MCP (15 seconds)

### Restore Data After E2E Tests

```bash
# After tests have polluted the data
curl -X POST http://localhost:3001/api/mocks/{mockId}/reset
# -> Instantly restores to original seed data
```

### Create Directly from Claude Code

```
# One command in IDE:
"Create an online bookstore Mock API"

# -> MCP auto-calls create_mock
# -> Returns Mock ID + endpoints
# -> Ready to use with fetch()
```

---

## Why MockSnap?

| Traditional Approach | MockSnap |
|---------------------|----------|
| Hardcoded JSON files | Live API (POST->GET reflected, auto timestamps) |
| json-server setup | Done in one sentence ("Create a shop API") |
| Writing MSW code | Generated without writing a single line of code |
| Recreate mock to change schema | Chat: "Add ratings to books" — instant update |
| Writing API docs separately | Auto-generated Swagger UI + ER diagram |
| REST only or GraphQL only | REST + GraphQL generated simultaneously |
| Mock without queries | Filter/sort/paginate/cursor/relations (Stripe-level) |
| No error testing | Auth, delay distribution, error rate, ETag, idempotency |
| Data pollution after tests | Restore with a single `POST /reset` |
| AI key required | Faker.js generates realistic data without a key |

**Frontend development -> Backend complete:** Just change the base URL from `mocksnap.dev/m/abc123` to `api.myapp.com` and you're done.
