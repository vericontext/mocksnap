# MockSnap Demo Guide

## 한 줄 소개

> "백엔드 없이 프론트엔드 개발하세요. 말로 설명하면 3초 만에 진짜 API가 생깁니다."

---

## Demo 1: 말로 설명하면 API가 생긴다 (30초)

**가장 쉬운 방법.** JSON을 준비할 필요도 없습니다.

### 1. http://localhost:3000 접속

### 2. "Natural Language" 탭 클릭

### 3. 원하는 API를 말로 설명

```
쇼핑몰 API 만들어줘. 상품, 주문, 유저. 한국어 데이터 10건씩.
```

다른 예시들:
```
블로그 API — 작성자, 글, 댓글, 태그
TODO 앱 — 프로젝트, 할일, 팀원
음식 배달 앱 — 가게, 메뉴, 주문, 리뷰
```

### 4. "Generate API" 클릭 → 3초 후 완성

AI가 알아서 결정합니다:
- 리소스 이름과 구조 (products, orders, users)
- 필드와 타입 (id, name, price, status...)
- 한국어 이름, 현실적 가격, 유효 이메일 등 리얼 데이터 10건

### 5. 바로 사용 가능

```bash
curl http://localhost:3001/m/{mockId}/products
# → 한국어 상품명, 현실적 가격이 담긴 10개 상품
```

> Anthropic API Key 필요 — 페이지 상단 "Anthropic API Key" 펼쳐서 자신의 키 입력

---

## Demo 2: JSON이 있다면 더 빠르게 (15초)

이미 원하는 데이터 형태를 알고 있을 때.

### 1. "JSON" 탭에 붙여넣기

```json
{
  "products": [
    { "id": 1, "name": "맥북 프로", "price": 3490000, "category": "laptop" }
  ],
  "orders": [
    { "id": 1, "productId": 1, "quantity": 1, "status": "shipped" }
  ]
}
```

**1건만 넣어도 됩니다.** "AI data amplification" 체크하면 AI가 10건으로 늘려줍니다. API 키가 없어도 Faker.js가 필드명을 보고 자동으로 리얼 데이터를 채웁니다.

### 2. "Generate API" → 즉시 REST + GraphQL 엔드포인트 생성

### 3. Stateful — POST하면 GET에 반영됨

```bash
curl -X POST http://localhost:3001/m/{mockId}/products \
  -H "Content-Type: application/json" \
  -d '{"name": "에어팟 프로", "price": 359000}'
# → createdAt, updatedAt 자동 추가됨

curl http://localhost:3001/m/{mockId}/products
# → 에어팟 프로 포함, 총 11건
```

---

## Demo 3: 실제 API처럼 쿼리 (30초)

프론트엔드 코드에서 바로 쓸 수 있는 수준.

```bash
# 필터링
curl ".../products?category=laptop"
curl ".../products?price_gte=500000&price_lte=2000000"

# 정렬
curl ".../products?sort=price&order=desc"

# 페이지네이션 (offset)
curl ".../products?page=2&limit=5"
# → X-Total-Count: 10, Link: <...?page=3>; rel="next"

# 페이지네이션 (cursor — Stripe 스타일)
curl ".../products?limit=5"
# → { "data": [...], "has_more": true, "next_cursor": "eyJpZCI6NX0=" }
curl ".../products?cursor=eyJpZCI6NX0=&limit=5"

# 검색
curl ".../products?q=맥북"

# 필드 선택
curl ".../products?fields=id,name,price"

# 관계: 유저 1의 주문 목록
curl ".../users/1/orders"

# 관계 확장: 주문에 상품 정보 포함
curl ".../orders?_expand=product"
# → { "id": 1, "status": "shipped", "product": { "name": "맥북 프로", ... } }

# 관계 임베드: 유저에 주문 목록 포함
curl ".../users/1?_embed=orders"
```

> Envelope 모드 켜면 `{ data, meta, links }` 래핑 + RFC 7807 에러 포맷

---

## Demo 4: 프로덕션 시나리오 테스트 (30초)

### 인증 시뮬레이션

대시보드 Settings에서 Auth 설정:
```bash
# Bearer Token 설정
curl -X PATCH ".../config" -d '{"auth":{"type":"bearer","key":"my-secret"}}'

# 토큰 없이 → 401
curl http://localhost:3001/m/{mockId}/products
# → {"type":"https://httpstatuses.com/401","title":"Unauthorized",...}

# 토큰 있으면 → 200
curl -H "Authorization: Bearer my-secret" http://localhost:3001/m/{mockId}/products
```

### 에러 & 지연 시뮬레이션

```bash
# 50% 확률로 503 에러 + 1~3초 랜덤 지연
curl -X PATCH ".../config" -d '{
  "errorRate": 0.5,
  "errorStatus": 503,
  "delay": {"type":"uniform","min":1000,"max":3000}
}'
```

### 중복 방지 (Idempotency Key)

```bash
# 같은 키로 2번 POST → 1건만 생성
curl -H "Idempotency-Key: order-123" -X POST ".../orders" -d '{"item":"맥북"}'
curl -H "Idempotency-Key: order-123" -X POST ".../orders" -d '{"item":"맥북"}'
# → 두 번째는 캐시된 응답 반환, 중복 생성 안 됨
```

### 캐시 테스트 (ETag)

```bash
# 첫 요청 → ETag 헤더 반환
curl -v http://localhost:3001/m/{mockId}/products
# → ETag: "a1b2c3..."

# 같은 ETag로 재요청 → 304 Not Modified (빈 바디)
curl -H 'If-None-Match: "a1b2c3..."' http://localhost:3001/m/{mockId}/products
# → 304
```

---

## Demo 5: GraphQL도 동시에 (15초)

별도 설정 없이 같은 Mock에서 REST + GraphQL 동시 사용.

```bash
curl -X POST http://localhost:3001/m/{mockId}/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ products { id name price } orders { id status } }"}'
```

```bash
# Mutation도 가능
curl -X POST http://localhost:3001/m/{mockId}/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createProduct(input: {name: \"아이폰\", price: 1500000}) { id name } }"}'
```

---

## Demo 6: E2E 테스트 지원 (15초)

```bash
# 테스트 중 데이터가 오염됐을 때 → 원래 상태로 리셋
curl -X POST http://localhost:3001/api/mocks/{mockId}/reset
# → 시드 데이터로 복원, 추가/수정/삭제 모두 되돌림
```

---

## Demo 7: Claude Code에서 바로 생성 (15초)

IDE에서 나가지 않고 Mock 생성.

```
# Claude Code에서 한마디:
"유저 CRUD Mock API 만들어줘"

# → MCP create_mock 도구 자동 호출
# → Mock ID + 엔드포인트 반환
# → 바로 fetch()에 URL 넣어서 개발 시작
```

---

## 핵심: 왜 MockSnap인가?

| 기존 방식 | MockSnap |
|-----------|----------|
| JSON 파일 하드코딩 | 살아있는 API (POST→GET 반영) |
| json-server 세팅 | 붙여넣기 한 번이면 끝 |
| MSW 코드 작성 | 코드 한 줄 없이 생성 |
| Postman Mock 설정 | 자연어 "쇼핑몰 API 만들어줘" |
| REST만 또는 GraphQL만 | REST + GraphQL 동시 생성 |
| 쿼리 안 되는 Mock | 필터/정렬/페이지네이션/관계/커서 |
| 에러 테스트 불가 | 지연, 에러율, 인증, ETag, Idempotency |
| 테스트 후 데이터 오염 | `POST /reset` 한 줄로 복원 |

**백엔드 완성 후:** base URL만 `mocksnap.dev/m/abc123` → `api.myapp.com`으로 바꾸면 끝.
