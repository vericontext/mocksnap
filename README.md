# MockSnap

> Paste JSON, describe in words, or drop an OpenAPI spec — get a live REST + GraphQL API in seconds.

MockSnap은 프론트엔드-백엔드 디커플링을 위한 AI 기반 Mock API 생성기입니다. JSON 샘플, 자연어 프롬프트, OpenAPI 스펙 중 아무거나 입력하면 즉시 살아있는 API를 만들어줍니다.

## Features

### 3가지 입력 모드

- **JSON** — 샘플 데이터 붙여넣기 → 스키마 자동 추론
- **Natural Language** — `"유저 CRUD API + 주문 목록, 한국어 데이터"` → AI가 스키마 + 데이터 생성
- **OpenAPI Spec** — OpenAPI 3.x JSON/YAML → 스키마 기반 리얼 데이터 생성

### REST + GraphQL 동시 생성

같은 스키마에서 양쪽 엔드포인트가 자동 생성됩니다.

```
REST:    http://localhost:3001/m/{mockId}/users
GraphQL: http://localhost:3001/m/{mockId}/graphql
```

### AI 기반 리얼 데이터

Claude API를 활용하여 컨텍스트 인식 데이터를 생성합니다.
- 한국어 이름, 현실적 나이(20~60), 유효 이메일, 한국 전화번호 등
- JSON 입력 시 시드 1~2건 → 10건으로 자동 증폭

### Stateful CRUD

POST로 만든 데이터가 GET에 반영됩니다. SQLite로 데이터를 영속화합니다.

```bash
POST /m/{id}/users  {"name":"Kim"}   # 생성
GET  /m/{id}/users                    # Kim 포함 반환
```

### 응답 커스텀

리소스별로 엣지 케이스를 시뮬레이션할 수 있습니다.

| 설정 | 설명 |
|------|------|
| Delay | 응답 지연 (ms) |
| Error Rate | 랜덤 에러 발생 확률 (0~100%) |
| Error Status | 에러 시 HTTP 상태 코드 (400, 500, 503 등) |
| Force Status | 모든 응답을 특정 상태 코드로 강제 |

### Webhook 시뮬레이션

리소스에 webhook URL을 설정하면 CRUD 발생 시 이벤트 payload를 자동 전송합니다.

```json
{ "event": "created", "resource": "users", "data": {...}, "timestamp": "..." }
```

### Request 로그

Mock API로 들어온 모든 요청/응답을 기록합니다. 대시보드에서 실시간 확인 가능합니다.

### MCP 서버

Claude Code, Cursor 등에서 직접 Mock API를 생성/관리할 수 있습니다.

```bash
# Claude Code에 등록
claude mcp add mocksnap -- npx tsx /path/to/apps/api/src/mcp-server.ts

# 이후 Claude Code에서:
# "유저 CRUD API 만들어줘" → create_mock 도구 자동 호출
```

MCP 도구: `create_mock`, `list_mocks`, `get_mock`, `delete_mock`

## Quick Start

### 요구사항

- Node.js 20+
- pnpm 10+

### 설치 & 실행

```bash
git clone https://github.com/vericontext/mocksnap.git
cd mocksnap
pnpm install

# AI 기능 사용 시 (선택)
echo "ANTHROPIC_API_KEY=sk-ant-..." > apps/api/.env

# 실행
pnpm dev
```

- Web UI: http://localhost:3000
- API: http://localhost:3001

### 빠른 테스트 (CLI)

```bash
# JSON으로 Mock 생성
curl -X POST http://localhost:3001/api/mocks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API",
    "sample": {
      "users": [{"id": 1, "name": "Kim", "email": "kim@test.com"}],
      "posts": [{"id": 1, "title": "Hello", "userId": 1}]
    }
  }'

# 자연어로 Mock 생성 (ANTHROPIC_API_KEY 필요)
curl -X POST http://localhost:3001/api/mocks \
  -H "Content-Type: application/json" \
  -d '{"name": "E-commerce", "prompt": "유저, 상품, 주문 API, 한국어 데이터"}'

# GraphQL 쿼리
curl -X POST http://localhost:3001/m/{mockId}/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ users { id name email } }"}'
```

## Tech Stack

| 레이어 | 기술 |
|--------|------|
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
│   ├── api/                    # Hono 백엔드 (port 3001)
│   │   └── src/
│   │       ├── index.ts        # HTTP 서버 엔트리포인트
│   │       ├── mcp-server.ts   # MCP 서버 엔트리포인트
│   │       ├── db/             # SQLite 연결, 스키마, 동적 테이블
│   │       ├── routes/         # REST CRUD, GraphQL, Config, 로그
│   │       └── services/       # 스키마 추론, AI, OpenAPI 파서, GraphQL 빌더
│   └── web/                    # Next.js 프론트엔드 (port 3000)
│       ├── app/                # 페이지 (랜딩, Mock 대시보드, 목록)
│       ├── components/         # JSON 입력, 엔드포인트 목록, 플레이그라운드, 로그
│       └── lib/                # API 클라이언트
└── packages/
    └── shared/                 # 공유 타입 및 상수
```

## API Reference

### Mock 관리

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/mocks` | Mock 생성 (JSON/prompt/OpenAPI) |
| GET | `/api/mocks` | 전체 Mock 목록 |
| GET | `/api/mocks/:id` | Mock 상세 |
| DELETE | `/api/mocks/:id` | Mock 삭제 |
| GET | `/api/mocks/:id/logs` | Request 로그 (최근 100건) |
| PATCH | `/api/mocks/:id/resources/:name/config` | 리소스 설정 변경 |

### 동적 Mock API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/m/:mockId/:resource` | 전체 조회 |
| GET | `/m/:mockId/:resource/:id` | 단건 조회 |
| POST | `/m/:mockId/:resource` | 생성 |
| PUT | `/m/:mockId/:resource/:id` | 전체 수정 |
| PATCH | `/m/:mockId/:resource/:id` | 부분 수정 |
| DELETE | `/m/:mockId/:resource/:id` | 삭제 |
| POST | `/m/:mockId/graphql` | GraphQL 쿼리/뮤테이션 |

## Roadmap

### 진짜 API처럼 동작하게

- [x] **필터링** — `GET /users?age_gte=20&age_lte=30&category=laptop`
- [x] **정렬** — `GET /users?sort=name&order=asc`
- [x] **페이지네이션** — `GET /users?page=2&limit=10` (총 건수 헤더 포함)
- [x] **전체 검색** — `GET /users?q=kim`
- [x] **중첩 리소스** — `GET /users/1/posts` (유저 1의 게시글)
- [x] **관계 확장** — `GET /posts?_expand=author&_embed=comments`
- [x] **깊은 관계** — `?_expand=post,post.user` 다단계 dot notation (최대 3단계)
- [x] **GraphQL 관계 타입** — FK 자동 감지, `{ users { posts { comments { user } } } }`
- [x] **Auth 시뮬레이션** — API Key, Bearer Token 검증

### Production-grade Mock (High Priority)

- [x] **ETag + 304** — 조건부 요청 (`If-None-Match` → `304 Not Modified`), React Query/SWR 캐시 테스트
- [x] **데이터 리셋** — `POST /api/mocks/:id/reset` 시드 데이터 복원, E2E 테스트 필수
- [x] **자동 timestamp** — POST 시 `createdAt`, PATCH 시 `updatedAt` 자동 주입
- [x] **커서 기반 페이지네이션** — `?cursor=xxx&limit=10`, Stripe/Shopify 표준
- [x] **Faker.js 스마트 데이터** — 필드명에서 의미 감지 (email→이메일, phone→전화번호)
- [x] **Idempotency Key** — `Idempotency-Key` 헤더로 중복 요청 방지 (Stripe 패턴)
- [x] **Webhook HMAC 서명** — `X-MockSnap-Signature` HMAC-SHA256 검증 헤더
- [x] **지연 분포** — 고정 delay 외에 uniform/normal 분포 지원

### 플랫폼 확장

- [ ] Record & Replay — 프로덕션 API 프록시 녹화 → Mock 자동 생성
- [ ] Team Workspace — 팀 워크스페이스 + Mock 버전 관리
- [ ] Cloud Deployment — Cloudflare Workers 엣지 호스팅
- [ ] Custom Domain — 와일드카드 서브도메인 (`abc123.mocksnap.dev`)
- [ ] Monaco Editor — 스키마 편집기 통합
- [ ] SDK/CLI — `npx mocksnap create "유저 API"`
- [ ] SQL DDL 입력 — `CREATE TABLE` 문에서 Mock 자동 생성
- [ ] OpenAPI 역생성 — Mock → OpenAPI 3.x 스펙 내보내기
- [ ] SSE/Streaming — `text/event-stream` 실시간 엔드포인트

## Changelog

### v0.8.0 (2026-03-28) — 깊은 관계 쿼리

- Deep expand: `?_expand=post,post.user` — 다단계 관계 확장 (최대 3단계)
- Deep embed: `?_embed=posts,posts.comments` — 다단계 관계 임베드
- GraphQL 관계 타입: FK 자동 감지하여 타입 간 관계 필드 생성 (`User.posts`, `Post.user`)
- GraphQL 중첩 쿼리: `{ users { posts { comments { user { name } } } } }`

### v0.7.0 (2026-03-28) — Production API 패턴

- Auth 시뮬레이션: API Key (`X-API-Key`) / Bearer Token 검증, 401 응답
- 커서 기반 페이지네이션: `?cursor=xxx&limit=10` → `{ data, has_more, next_cursor }` (Stripe 패턴)
- Webhook HMAC 서명: `X-MockSnap-Signature` + `X-MockSnap-Timestamp` 헤더
- 지연 분포: 고정(ms), uniform(min~max), normal(mean±sigma) 지원
- Idempotency Key: `Idempotency-Key` 헤더로 중복 POST 방지 (24시간 캐싱)
- Faker.js 스마트 데이터: AI 키 없이도 필드명 감지하여 리얼 데이터 자동 생성

### v0.6.0 (2026-03-28) — 캐시, 리셋, 타임스탬프

- ETag + `304 Not Modified`: GET 응답에 ETag 해시, `If-None-Match` 매칭 시 304 반환
- 데이터 리셋: `POST /api/mocks/:id/reset` — 시드 데이터 스냅샷으로 복원
- 자동 timestamp: POST 시 `createdAt`/`updatedAt`, PUT/PATCH 시 `updatedAt` 자동 주입

### v0.5.0 (2026-03-28) — Production-grade 응답

- 응답 Envelope: `{ data, meta, links }` 래핑 (리소스별 on/off)
- RFC 7807 Problem Details 에러 포맷 (`type`, `title`, `status`, `detail`, `instance`)
- 필드 선택: `?fields=id,name` — 지정 필드만 반환
- `Location` 헤더: POST 201 응답에 생성된 리소스 URL
- Rate Limit 헤더: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- `Link` 헤더: RFC 8288 표준 페이지네이션 (`rel="next"`, `rel="last"` 등)

### v0.4.0 (2026-03-28) — 진짜 API처럼

- 필터링: `?age_gte=20&age_lte=30`, `?name=Kim`, `?status_ne=deleted`, `?name_like=kim`
- 정렬: `?sort=name&order=asc`
- 페이지네이션: `?page=2&limit=10` + `X-Total-Count` 응답 헤더
- 전체 검색: `?q=kim`
- 중첩 리소스: `/users/1/posts` (FK 자동 감지)
- 관계 확장: `?_expand=user` (FK → 원본 객체로 교체)
- 관계 임베드: `?_embed=posts` (1:N 하위 리소스 배열 포함)

### v0.3.0 (2026-03-28) — 배포 준비

- BYOK (Bring Your Own Key): 사용자가 자신의 Anthropic API 키로 AI 기능 사용
- Rate limit: IP당 Mock 생성 10회/시간
- Mock TTL: 7일 자동 만료 + 주기적 정리
- Fly.io 배포 설정 (Dockerfile + fly.toml + 영속 볼륨)
- Vercel 프론트엔드 배포 설정

### v0.2.0 (2026-03-28) — 확장 기능

- GraphQL 엔드포인트 자동 생성 (같은 스키마에서 REST + GraphQL 동시)
- MCP 서버 — Claude Code/Cursor에서 직접 Mock 생성/관리
- Webhook 시뮬레이션 (CRUD 시 설정된 URL로 이벤트 payload 전송)
- Request 로그 (모든 요청/응답 기록 + 대시보드 실시간 표시)

### v0.1.0 (2026-03-28) — MVP

- JSON 샘플 입력 → REST API 자동 생성 + Stateful CRUD
- AI 자연어 입력 → 스키마 + 리얼 데이터 자동 생성 (Claude API)
- AI 데이터 증폭 (시드 1~2건 → 10건 리얼 데이터)
- OpenAPI 3.x 스펙 입력 (JSON/YAML)
- 응답 커스텀 (지연, 에러율, 상태코드, 강제 상태)
- Mock 목록 관리 페이지
- Web UI (Next.js) + API Playground

## License

MIT
