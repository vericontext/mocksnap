# MockSnap Demo Guide

## 한 줄 소개

> "백엔드 없이 프론트엔드 개발하세요. JSON 붙여넣으면 3초 만에 진짜 REST + GraphQL API가 생깁니다."

---

## Demo 1: JSON 붙여넣기 → 즉시 API 생성 (30초)

**시나리오:** 프론트엔드 개발자가 쇼핑몰 앱을 만드는데, 백엔드가 아직 없다.

### 1. http://localhost:3000 접속

### 2. JSON 입력란에 아래를 붙여넣기

```json
{
  "products": [
    { "id": 1, "name": "맥북 프로 16인치", "price": 3490000, "category": "laptop" },
    { "id": 2, "name": "아이패드 에어", "price": 929000, "category": "tablet" }
  ],
  "orders": [
    { "id": 1, "productId": 1, "quantity": 1, "status": "shipped" }
  ]
}
```

### 3. "AI data amplification" 체크 해제 → "Generate API" 클릭

### 4. 결과: 즉시 CRUD API가 생성됨

```
GET    /m/{id}/products      → 상품 목록
GET    /m/{id}/products/1    → 상품 상세
POST   /m/{id}/products      → 상품 추가
PUT    /m/{id}/products/1    → 상품 수정
DELETE /m/{id}/products/1    → 상품 삭제
```

### 5. Playground에서 바로 테스트

URL 입력 → Send → 실제 데이터 반환 확인

### 6. Stateful 데모

터미널에서 POST로 상품 추가:
```bash
curl -X POST http://localhost:3001/m/{mockId}/products \
  -H "Content-Type: application/json" \
  -d '{"id": 3, "name": "에어팟 프로", "price": 359000, "category": "audio"}'
```

Playground에서 다시 GET → **3개** 반환됨. "POST한 데이터가 GET에 반영됩니다."

---

## Demo 2: 진짜 API처럼 쿼리 (30초)

**시나리오:** 프론트엔드에서 필터, 정렬, 페이지네이션이 필요하다.

### Demo 1에서 만든 Mock으로 바로 이어서:

```bash
# 카테고리 필터링
curl "http://localhost:3001/m/{mockId}/products?category=laptop"
# → 맥북 프로만 반환

# 가격 범위 필터
curl "http://localhost:3001/m/{mockId}/products?price_gte=500000"
# → 50만원 이상 상품만

# 정렬
curl "http://localhost:3001/m/{mockId}/products?sort=price&order=desc"
# → 비싼 순서대로

# 페이지네이션
curl -v "http://localhost:3001/m/{mockId}/products?page=1&limit=2"
# → 2건 반환 + 응답 헤더에 X-Total-Count: 3

# 검색
curl "http://localhost:3001/m/{mockId}/products?q=에어"
# → "에어"가 포함된 상품만
```

### 관계 데이터 쿼리

```bash
# 중첩 리소스: 상품 1번의 주문 목록
curl "http://localhost:3001/m/{mockId}/products/1/orders"

# 관계 확장: 주문에 상품 정보 포함
curl "http://localhost:3001/m/{mockId}/orders?_expand=product"
# → { "id": 1, "status": "shipped", "product": { "name": "맥북 프로 16인치", ... } }

# 관계 임베드: 상품에 주문 목록 포함
curl "http://localhost:3001/m/{mockId}/products/1?_embed=orders"
# → { "name": "맥북 프로 16인치", ..., "orders": [{ "id": 1, ... }] }
```

> "json-server 수준의 쿼리가 설정 없이 동작합니다."

---

## Demo 3: 자연어로 API 생성 (30초)

**시나리오:** API 구조도 모르겠고, 그냥 말로 설명하고 싶다.

### 1. "Natural Language" 탭 클릭

### 2. 프롬프트 입력

```
블로그 API 만들어줘. 작성자, 글, 댓글, 태그. 한국어 데이터로 10건씩.
```

### 3. "Generate API" 클릭 → AI가 스키마 + 리얼 데이터 자동 생성

결과: authors, posts, comments, tags 4개 리소스 × 10건 데이터 생성

### 4. 바로 사용 가능

```bash
curl http://localhost:3001/m/{mockId}/posts
# → 한국어 제목, 본문, 현실적인 날짜가 담긴 10개 게시글
```

> Anthropic API Key 필요 — 페이지 상단 "Anthropic API Key" 펼쳐서 입력

---

## Demo 4: GraphQL도 동시에 (15초)

**시나리오:** 같은 데이터를 GraphQL로도 쓰고 싶다.

### Demo 1에서 만든 Mock의 GraphQL 엔드포인트 사용

```bash
curl -X POST http://localhost:3001/m/{mockId}/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ products { id name price } orders { id status } }"}'
```

응답:
```json
{
  "data": {
    "products": [
      { "id": "1", "name": "맥북 프로 16인치", "price": 3490000 },
      { "id": "2", "name": "아이패드 에어", "price": 929000 }
    ],
    "orders": [
      { "id": "1", "status": "shipped" }
    ]
  }
}
```

> "REST와 GraphQL이 같은 스키마에서 동시에 생성됩니다. 별도 설정 없이."

---

## Demo 5: 에러 시뮬레이션 (15초)

**시나리오:** 프론트엔드에서 에러 핸들링을 테스트하고 싶다.

### 1. 대시보드에서 /products의 "Settings" 클릭

### 2. 설정 변경

- Delay: 2000ms (2초 지연)
- Error rate: 50%
- Error status: 503 Service Unavailable

### 3. "Save Config" 클릭

### 4. Playground에서 GET 여러 번 → 절반은 2초 뒤 정상, 절반은 503 에러

> "불안정한 외부 API를 시뮬레이션할 수 있습니다."

---

## Demo 6: Claude Code에서 바로 생성 (15초)

**시나리오:** IDE에서 코딩하다가 Mock이 필요하다.

```
# Claude Code에서 한마디:
"유저 CRUD Mock API 만들어줘"

# → MCP create_mock 도구가 자동 호출
# → Mock ID + 엔드포인트 목록 반환
# → 바로 코드에서 fetch() 사용
```

---

## 핵심 메시지

| 기존 방식 | MockSnap |
|-----------|----------|
| JSON 파일 하드코딩 | 살아있는 API (POST→GET 반영) |
| json-server 세팅 | 붙여넣기 한 번이면 끝 |
| MSW 코드 작성 | 코드 한 줄 없이 API 생성 |
| Postman Mock 설정 | 자연어로 "유저 API 만들어줘" |
| REST만 또는 GraphQL만 | REST + GraphQL 동시 생성 |
| 쿼리 안 되는 단순 Mock | 필터/정렬/페이지네이션/관계 쿼리 지원 |

**백엔드 완성 후:** base URL만 `mocksnap.dev/m/abc123` → `api.myapp.com`으로 바꾸면 끝.
