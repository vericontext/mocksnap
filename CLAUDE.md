# MockSnap

AI 기반 Mock API 생성기. JSON/자연어/OpenAPI 입력 → 즉시 REST + GraphQL API 생성.

## 프로젝트 구조

pnpm workspace + Turborepo 모노레포.

- `apps/api` — Hono 백엔드 (port 3001), ESM (`"type": "module"`)
- `apps/web` — Next.js 15 App Router 프론트엔드 (port 3000), Tailwind CSS 4
- `packages/shared` — 공유 TypeScript 타입 및 상수

## 빌드 & 실행

```bash
pnpm install                      # 의존성 설치
pnpm dev                          # 전체 실행 (turborepo → api + web 동시)
pnpm --filter @mocksnap/api dev   # API만 실행
pnpm --filter @mocksnap/web dev   # Web만 실행
pnpm --filter @mocksnap/api mcp   # MCP 서버 (STDIO)
```

## 코딩 컨벤션

- TypeScript strict 모드, ESM (`import/export`)
- 백엔드 import 경로에 `.js` 확장자 필수 (ESM 규칙): `import { db } from './connection.js'`
- shared 패키지는 빌드 없이 소스 직접 참조 (`"main": "./src/index.ts"`)
- 새 타입 추가 시 `packages/shared/src/types.ts`에 정의하고 `index.ts`에서 re-export
- Hono 라우트는 `apps/api/src/routes/`에 파일별 분리, `index.ts`에서 `app.route()`로 마운트
- 프론트엔드 컴포넌트는 `apps/web/components/`에 파일별 분리, `'use client'` 필수
- 스타일링은 Tailwind CSS utility class만 사용 (별도 CSS 파일 금지)

## 아키텍처 핵심

### 데이터 흐름

```
입력(JSON/prompt/OpenAPI) → mock-service.ts → inferSchema() or AI → DB 저장 → 동적 라우팅
```

### DB (SQLite)

- 단일 파일: `apps/api/data/mocksnap.db` (gitignore 대상)
- 메타 테이블: `mocks`, `mock_resources`, `request_logs`
- 동적 데이터 테이블: `mock_{mockId}_{resource}` — 각 행은 `data` 컬럼에 JSON blob 저장
- 쿼리: `json_extract(data, '$.field')`로 필터/정렬/검색 수행
- WAL 모드 활성화

### 핵심 서비스 (apps/api/src/services/)

- `mock-service.ts` — Mock CRUD 오케스트레이션 (createMock, getMock, listMocks, deleteMock)
- `schema-inferrer.ts` — JSON → 리소스/필드 추론 + Faker.js 스마트 데이터 생성 (`generateFakerData`)
- `ai-service.ts` — Claude API 연동 (generateFromPrompt, amplifyData). ANTHROPIC_API_KEY 환경변수 필요
- `openapi-parser.ts` — OpenAPI 3.x JSON/YAML → 리소스 파싱
- `graphql-schema.ts` — 동적 SDL + resolver 빌드, FK 자동 감지하여 관계 필드 생성 (belongsTo/hasMany)

### 라우트 (apps/api/src/routes/)

- `mocks.ts` — `POST/GET/DELETE /api/mocks`, `GET /api/mocks/:id/logs`, `POST /api/mocks/:id/reset`
- `dynamic.ts` — `ALL /m/:mockId/:resource/:id?` (REST CRUD + 쿼리 + 관계 + 로깅 + webhook)
- `graphql.ts` — `ALL /m/:mockId/graphql` (graphql-yoga)
- `config.ts` — `GET/PATCH /api/mocks/:id/resources/:name/config`

### 엔트리포인트

- `apps/api/src/index.ts` — HTTP 서버 (Hono + @hono/node-server)
- `apps/api/src/mcp-server.ts` — MCP 서버 (STDIO, @modelcontextprotocol/sdk)

## 테스트 방법

테스트 프레임워크 미도입 상태. curl로 수동 검증:

```bash
# Mock 생성
curl -X POST http://localhost:3001/api/mocks \
  -H "Content-Type: application/json" \
  -d '{"name":"test","sample":{"users":[{"id":1,"name":"Kim"}]},"amplify":false}'

# CRUD 확인
curl http://localhost:3001/m/{mockId}/users

# GraphQL
curl -X POST http://localhost:3001/m/{mockId}/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ users { id name } }"}'
```

## 주의사항

- `better-sqlite3`는 네이티브 빌드 필요 — `pnpm install` 시 빌드 승인됨 (`pnpm.onlyBuiltDependencies`)
- Bun 미설치 환경: `@hono/node-server` + `tsx watch`로 Node.js fallback 사용 중
- AI 기능은 BYOK(사용자 키) 또는 서버 `ANTHROPIC_API_KEY` 필요. 둘 다 없으면 AI 비활성화, JSON 입력은 정상 동작
- 동적 라우트 쿼리: `?field_gte=`, `?sort=&order=`, `?page=&limit=`, `?cursor=`, `?q=`, `?fields=`, `?_expand=`, `?_embed=`
- 관계 dot notation: `?_expand=post,post.user` (최대 3단계). FK는 `{singular}Id` 패턴 자동 감지
- 중첩 리소스: `/resource/:id/subResource` — FK 기반 자동 필터
- 응답 포맷: `ResourceConfig.envelope=true` 시 `{ data, meta, links }` 래핑, 에러는 RFC 7807
- ETag: GET 응답에 MD5 해시 ETag, `If-None-Match` → 304. POST/PUT/PATCH 시 `createdAt`/`updatedAt` 자동 주입
- Auth: `ResourceConfig.auth` 설정 시 `X-API-Key` 또는 `Authorization: Bearer` 검증
- Idempotency: `Idempotency-Key` 헤더로 POST 중복 방지 (24시간 인메모리 캐시)
- Faker fallback: AI 키 없으면 `@faker-js/faker`로 필드명 기반 리얼 데이터 자동 생성
- 동적 테이블명은 SQL 인젝션 방지를 위해 `sanitizeName()`으로 영숫자+언더스코어만 허용
- `.env` 파일은 `apps/api/.env`에 위치, gitignore 대상
- 배포: Dockerfile(`apps/api/Dockerfile`) + fly.toml (Fly.io), vercel.json (Vercel)
