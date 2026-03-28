# MockSnap Demo Guide

## 한 줄 소개

> "백엔드 없이 프론트엔드 개발하세요. 말 한마디면 API 문서까지 완성됩니다."

---

## Demo 1: 말로 설명하면 API가 생긴다 (30초)

**JSON 준비 필요 없음.** 말로 설명하면 됩니다.

### 1. http://localhost:3000 접속 → "Natural Language" 탭 클릭

### 2. 원하는 API를 자연어로 설명

```
온라인 서점 API. 작가, 책, 리뷰, 유저.
책은 작가와 연결, 리뷰는 책과 유저에 연결.
한국어 데이터 5건씩.
```

### 3. "Generate API" 클릭 → 3초 후 완성

AI가 생성하는 것들:
- **API 구조** — authors, books, reviews, users 4개 리소스
- **필드 설계** — title, price, isbn, rating, birth_year 등 의미 있는 필드
- **관계 설정** — `books.author_id → authors`, `reviews.book_id → books`
- **리얼 데이터** — "살인자의 기억법(김영하)", "채식주의자(한강)" 등 실제 한국 문학 데이터

### 4. 즉시 확인할 수 있는 것들

| URL | 설명 |
|-----|------|
| `/m/{id}/docs` | API 문서 (Scalar UI) — Try it out 버튼으로 바로 테스트 |
| `/m/{id}/books` | REST API — curl이나 fetch()로 호출 |
| `/m/{id}/graphql` | GraphQL — 관계까지 한 쿼리로 |
| 대시보드 | ER 다이어그램 — 관계 구조 시각화 |

> Anthropic API Key 필요 — 페이지 상단 "Anthropic API Key" 펼쳐서 자신의 키 입력

---

## Demo 2: JSON 1건이면 API 키 없이도 OK (15초)

API 키가 없어도 됩니다. JSON 1건만 넣으면 Faker.js가 나머지를 채웁니다.

### 1. "JSON" 탭에 최소한의 구조만 입력

```json
{
  "users": [
    { "id": 1, "name": "", "email": "", "phone": "", "age": 0 }
  ]
}
```

### 2. "Generate API" → Faker.js가 필드명을 보고 자동으로 리얼 데이터 생성

```json
[
  { "id": 1, "name": "", "email": "", "phone": "", "age": 0 },
  { "id": 2, "name": "Lucille Schinner", "email": "Gaston_Turner13@gmail.com", "phone": "(975) 591-4320", "age": 32 },
  { "id": 3, "name": "Joy Haley-Bruen", "email": "Chance.Kling96@gmail.com", "phone": "(910) 702-8061", "age": 28 }
]
```

`name` → 이름, `email` → 이메일, `phone` → 전화번호... 필드명만 보고 알아서 채웁니다.

### 3. POST하면 GET에 반영 (Stateful)

```bash
curl -X POST .../users -H "Content-Type: application/json" \
  -d '{"name": "새 유저", "email": "new@test.com"}'
# → createdAt, updatedAt 자동 추가

curl .../users  # → 새 유저 포함
```

---

## Demo 3: API 문서 + ER 다이어그램 자동 생성 (15초)

Mock을 만들면 **즉시** 두 가지가 자동 생성됩니다.

### Swagger UI (Scalar)

`http://localhost:3001/m/{mockId}/docs` 접속 →

- 모든 엔드포인트 목록 (GET, POST, PUT, PATCH, DELETE)
- 쿼리 파라미터 문서 (sort, page, cursor, _expand...)
- "Test Request" 버튼으로 브라우저에서 바로 API 호출
- OpenAPI 스펙 다운로드 (`/openapi.json`)
- Shell, Node.js, Python, Ruby 등 클라이언트 코드 자동 생성

### ER 다이어그램

대시보드 상단에 Mermaid ER 다이어그램이 자동 렌더링:

```
authors ──── has many ──── books ──── has many ──── reviews
                                                      │
users ──────────────── has many ─────────────────────┘
```

FK 필드(`author_id`, `book_id`, `user_id`)를 자동 감지. Light/Dark 모드에 맞게 테마 전환.

---

## Demo 4: 실제 API처럼 쿼리 (30초)

프론트엔드 코드에서 **그대로** 쓸 수 있는 수준.

```bash
# 필터링 — 가격 50만원 이상 노트북만
curl ".../books?price_gte=15000&genre=소설"

# 정렬 — 비싼 순서
curl ".../books?sort=price&order=desc"

# 페이지네이션 (Stripe 스타일 커서)
curl ".../books?limit=3"
# → { "data": [...], "has_more": true, "next_cursor": "eyJpZCI6M30=" }
curl ".../books?cursor=eyJpZCI6M30=&limit=3"

# 검색
curl ".../books?q=채식"

# 필드 선택 — 필요한 필드만
curl ".../books?fields=id,title,price"

# 관계 확장 — 책에 작가 정보 포함
curl ".../books?_expand=author"
# → { "title": "채식주의자", "author": { "name": "한강" } }

# 깊은 관계 — 작가 → 책들 → 리뷰들 (3단계)
curl ".../authors/1?_embed=books,books.reviews"
```

> Envelope 모드 켜면 `{ data, meta: { total, page }, links: { next, prev } }` 래핑. RFC 7807 에러 포맷.

---

## Demo 5: 프로덕션 시나리오 (30초)

### 인증

```bash
# Bearer Token 설정 → 토큰 없으면 401
curl -X PATCH ".../config" -d '{"auth":{"type":"bearer","key":"my-secret"}}'
curl .../books                                        # → 401 Unauthorized
curl -H "Authorization: Bearer my-secret" .../books   # → 200
```

### 불안정한 API 시뮬레이션

```bash
# 50% 확률 503 에러 + 1~3초 랜덤 지연
curl -X PATCH ".../config" -d '{
  "errorRate": 0.5, "errorStatus": 503,
  "delay": {"type":"uniform","min":1000,"max":3000}
}'
```

### 중복 방지 & 캐시

```bash
# Idempotency Key — 같은 키로 2번 POST → 1건만 생성
curl -H "Idempotency-Key: order-1" -X POST .../orders -d '{"item":"맥북"}'
curl -H "Idempotency-Key: order-1" -X POST .../orders -d '{"item":"맥북"}'
# → 두 번째는 캐시 응답, 중복 없음

# ETag — 데이터 안 바뀌면 304 (React Query/SWR 캐시 테스트)
curl -v .../books                                     # → ETag: "a1b2c3..."
curl -H 'If-None-Match: "a1b2c3..."' .../books        # → 304 Not Modified
```

---

## Demo 6: GraphQL — 복잡한 관계도 한 쿼리로 (15초)

FK를 자동 감지하여 관계 타입이 생성됩니다. 별도 설정 없이:

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
→ 김영하
    살인자의 기억법
      ★5 "김영하 작가의 독특한 상상력이 돋보이는 작품" — 이민수
  한강
    채식주의자
      ★4 "강렬하고 충격적인 내용이지만 깊이 있는 메시지" — 박지은
```

---

## Demo 7: 데이터 리셋 + MCP (15초)

### E2E 테스트 후 데이터 복원

```bash
# 테스트로 데이터가 오염된 후
curl -X POST http://localhost:3001/api/mocks/{mockId}/reset
# → 원래 시드 데이터로 즉시 복원
```

### Claude Code에서 바로 생성

```
# IDE에서 한마디:
"온라인 서점 Mock API 만들어줘"

# → MCP가 자동으로 create_mock 호출
# → Mock ID + 엔드포인트 반환
# → fetch()에 바로 사용
```

---

## 핵심: 왜 MockSnap인가?

| 기존 방식 | MockSnap |
|-----------|----------|
| JSON 파일 하드코딩 | 살아있는 API (POST→GET 반영, 자동 timestamp) |
| json-server 세팅 | 말 한마디면 끝 ("쇼핑몰 API 만들어줘") |
| MSW 코드 작성 | 코드 한 줄 없이 생성 |
| API 문서 따로 작성 | Swagger UI + ER 다이어그램 자동 생성 |
| REST만 또는 GraphQL만 | REST + GraphQL 동시 생성 |
| 쿼리 안 되는 Mock | 필터/정렬/페이지네이션/커서/관계 (Stripe 수준) |
| 에러 테스트 불가 | Auth, 지연분포, 에러율, ETag, Idempotency |
| 테스트 후 데이터 오염 | `POST /reset` 한 줄로 복원 |
| AI 키 필수 | 키 없어도 Faker.js가 리얼 데이터 생성 |

**프론트엔드 개발 → 백엔드 완성 후:** base URL만 `mocksnap.dev/m/abc123` → `api.myapp.com`으로 바꾸면 끝.
