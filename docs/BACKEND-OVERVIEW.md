# method-commerce API — Backend Overview

This document describes **method-commerce-api**: the NestJS backend for the method-commerce store. It is a customer + back-office HTTP API that owns catalog, identity, basket, checkout, payments, comments, and in-app notifications.

- Package: `method-commerce-api` (v0.1.0)
- Default URL: `http://localhost:4000/api`
- Interactive docs (non-production): `http://localhost:4000/api/docs`
- Prices: whole **Rial** (integers, never floats)
- Locale: Iranian mobile numbers, Kavenegar SMS, Zibal online payments, Persian product slugs

---

## 1. What it provides

The API is split into a **storefront** (customers) and a **back office** (admins). Customer JWTs and admin JWTs are **not interchangeable**.

### Storefront (customer)

| Capability | What the customer can do |
|---|---|
| **Phone OTP login** | Request an SMS code, verify it, get access + refresh tokens. Unknown numbers are registered automatically. |
| **Account** | Read and update profile (`GET/PATCH /users/me`). |
| **Locations** | List provinces and cities for address forms. |
| **Addresses** | CRUD delivery addresses, including a different receiver. |
| **Catalog** | Browse published categories, brands, and products (options, variants, prices, stock). |
| **Favorites** | Wishlist published products. |
| **Basket** | One open cart of product **variants**; add / change qty / increase / decrease / remove / clear. Stock is checked on quantity changes. |
| **Checkout** | Preview totals, then place an order from the basket (COD or online). Address and line prices are snapshotted. |
| **Orders** | List, get, cancel pending orders, start an online payment. |
| **Payments** | Redirected to Zibal; callback returns to the frontend order page. |
| **Comments** | Post product comments/replies (hidden until admin approval), upload images, delete own comments. |
| **Notifications** | In-app inbox; mark one or all as read. |

### Back office (admin)

| Capability | What operators can do |
|---|---|
| **Email/password login** | Access token (default 12h). Forgot / reset / change password. |
| **Accounts** | Super admin (`admin` role) can create other back-office users. |
| **Catalog** | Full CRUD on categories, brands, products, product options, variants, and stock. Drafts are visible only here. |
| **Orders** | List/filter all orders, cancel pending, confirm COD payment, mark paid orders delivered. |
| **Comments** | Pending queue, list all comments on a product, post as admin (live immediately), approve/hide, delete. |
| **Notifications** | Admin inbox of store events (new order, paid, cancelled, completed). |

### Cross-cutting platform

- Swagger/OpenAPI in non-production
- Unified error envelope (`code`, `message`, `details`, `requestId`)
- Request-id logging (`x-request-id`)
- Rate limiting (120 req/min global; OTP is 3/min)
- Helmet, compression, CORS, Winston rotating logs
- Local disk uploads served at a public path
- Health checks that ping the database (and Redis and search for readiness)
- Docker Compose: PostgreSQL 17 + Redis 7 + Meilisearch + API

---

## 2. Stack and runtime

| Layer | Choice |
|---|---|
| Runtime | Node 22, TypeScript (strict) |
| Framework | NestJS 12 |
| Architecture | DDD + onion (bounded contexts) |
| Database | PostgreSQL 17 via Prisma 6 (moved from MySQL 8; raw SQL uses Postgres syntax) |
| Cache / OTP / jobs | Redis 7, BullMQ |
| Auth | JWT (customer vs admin audiences) |
| SMS | Console (dev) or Kavenegar |
| Mail | Nodemailer (admin password reset) |
| Payments | Zibal |
| Uploads | Local disk (`uploads/`) |

Path aliases: `@shared/*`, `@modules/*`, `@config/*`.

---

## 3. Structure

### 3.1 Repository layout

```
method-commerce-core/
├── src/
│   ├── main.ts                 # bootstrap: helmet, CORS, validation, Swagger
│   ├── app.module.ts           # wires modules, guards, filters, jobs
│   ├── health.controller.ts
│   ├── config/                 # typed env (app, jwt, otp, sms, redis, payment, …)
│   ├── shared/                 # kernel used by every bounded context
│   │   ├── domain/             # Entity, AggregateRoot, Money, DomainError
│   │   ├── application/        # UseCase, ports (SMS, JWT, clock, storage, …)
│   │   ├── infrastructure/     # Prisma, Redis, JWT, Kavenegar, Winston, disk
│   │   └── presentation/       # exception filter, request-id, Swagger helpers
│   └── modules/                # bounded contexts (see below)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── postman/                    # collection + local environment
├── docker-compose.yml
└── Dockerfile                  # multi-stage; migrate then start
```

### 3.2 Onion layers (every module)

Each bounded context follows the same inside-out dependency rule: **domain has no Nest/Prisma types**. Outer layers depend inward.

```
modules/<context>/
  domain/           # aggregates, VOs, repository interfaces, errors, events
  application/      # use cases, ports, view DTOs, mappers
  infrastructure/   # Prisma repos, gateways, jobs, event listeners
  presentation/     # HTTP controllers, request DTOs, guards
  <context>.module.ts
```

A typical request:

```
HTTP controller
  → Use case
    → Domain aggregate (business rules)
    → Repository port
      → Prisma adapter
  → View / response DTO
```

Domain errors are thrown from domain/application. A single `AllExceptionsFilter` maps them to HTTP:

| Domain error | HTTP | `code` |
|---|---|---|
| `InvalidInputError` | 400 | `INVALID_INPUT` |
| `UnauthenticatedError` | 401 | `UNAUTHENTICATED` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `TooManyRequestsError` | 429 | `TOO_MANY_REQUESTS` |
| `BusinessRuleViolationError` | 422 | `BUSINESS_RULE_VIOLATION` |
| anything else | 500 | (logged, not leaked) |

### 3.3 Bounded contexts

```
Identity ──guards──► all other modules
Catalog  ──sellable variants──► Basket, Favorites, Comments, Ordering
Basket   ──open cart──► Ordering (checkout)
Addressing ──address snapshot──► Ordering
Ordering ──lifecycle events──► Notifications
Catalog  ──catalog.changed──► Search, Stock alerts, response cache, storefront revalidation
```

| Module | Responsibility |
|---|---|
| **Identity** | Customer OTP auth, admin password auth, profiles, JWT guards |
| **Addressing** | Provinces/cities, customer delivery addresses |
| **Catalog** | Category tree, brands, products, options, variants, inventory levels |
| **Favorites** | Per-user wishlist; each saved product can remember the chosen variant |
| **Basket** | One open cart per customer (lines are variants) |
| **Ordering** | Checkout, orders, inventory reservation, Zibal payments, jobs |
| **Comments** | Product Q&A / reviews with one-level replies and moderation |
| **Notifications** | In-app inbox; other modules call `sendNotification` |
| **Promotions** | Coupons and automatic campaigns; one per order, the best one wins |
| **Store** | Store settings: VAT rate, return window, seller details for invoices |
| **Backoffice** | Dashboard and reports, CSV exports, customers, stock adjustments, admin audit log |
| **Search** | Product search with facets, suggestions and recommendations (Meilisearch or in memory) |
| **Stock alerts** | "Tell me when it's back" SMS per variant |

Shared infrastructure (global): Prisma, Redis (OTP store, response cache), JWT, bcrypt, SMS, mail, object storage (disk or S3), event publisher, clock.

---

## 4. API map

Global prefix: `/api` (override with `API_PREFIX`).

### Public

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness + `SELECT 1` on the database |
| GET | `/health/ready` | Database, Redis and search; 503 when one is down |
| POST | `/auth/otp/request` | Send SMS code (3/min) |
| POST | `/auth/otp/verify` | Issue token pair; activates account |
| POST | `/auth/refresh` | New access token from stored refresh token |
| POST | `/admin/auth/login` | Admin email + password |
| POST | `/admin/auth/forgot-password` | Emails a reset token |
| POST | `/admin/auth/reset-password` | Completes reset |
| GET | `/locations/provinces` | |
| GET | `/locations/provinces/:id/cities` | |
| GET | `/categories` | Tree |
| GET | `/categories/:slug` | |
| GET | `/brands` | |
| GET | `/brands/:slug` | |
| GET | `/products` | Published only; filters + pagination |
| GET | `/products/:slug` | Options + variants |
| GET | `/products/:slug/comments` | Published comments; authors carry `verifiedBuyer` |
| GET | `/products/:slug/related` | In-stock best sellers of the same category, then brand |
| GET | `/products/:slug/bought-together` | Products most often in the same orders |
| GET | `/search` | Words, category subtree, brands, option values, price, stock; sorts; facets |
| GET | `/search/suggest` | Type-ahead products and categories |
| GET | `/sitemap`, `/slug-redirects/:type/:slug` | For the storefront's sitemap and 301s |
| GET | `/payments/callback` | Zibal browser redirect (unauthenticated) |

### Customer (Bearer `customer`)

| Method | Path |
|---|---|
| POST | `/auth/logout` |
| GET, PATCH | `/users/me` |
| CRUD | `/users/me/addresses` |
| GET, POST, PATCH, DELETE | `/users/me/favorites` (PATCH `:productId` sets the variant) |
| GET, POST, DELETE | `/users/me/stock-alerts` |
| GET, mutate, DELETE | `/users/me/basket` (+ `/items`, `/increase`, `/decrease`) |
| POST | `/orders`, `/orders/preview` |
| GET | `/orders`, `/orders/:id` |
| POST | `/orders/:id/cancel`, `/orders/:id/payments` |
| GET, POST | `/users/me/notifications` (+ `:id/read`, `read-all`) |
| GET | `/users/me/comments` |
| POST | `/products/:productId/comments` |
| DELETE | `/users/me/comments/:id` |

### Admin (Bearer `admin`)

| Method | Path |
|---|---|
| GET | `/admin/auth/me` |
| POST | `/admin/auth/change-password` |
| GET, POST | `/admin/accounts` (+ PUT `:id/permissions`) |
| POST | `/admin/uploads` |
| POST | `/admin/search/reindex` |
| CRUD | `/admin/promotions`, `/admin/shipping-methods` |
| GET, PUT | `/admin/settings` |
| GET | `/admin/reports/*`, `/admin/customers`, `/admin/stock`, `/admin/audit-log` |
| CRUD | `/admin/categories`, `/admin/brands`, `/admin/products` |
| PUT | `/admin/products/:id/options` |
| POST/PATCH/DELETE | `/admin/products/:id/variants` |
| GET | `/admin/orders`, `/admin/orders/:id` |
| POST | `/admin/orders/:id/cancel`, `confirm-payment`, `complete` |
| GET | `/admin/comments/pending` |
| GET, POST | `/admin/products/:productId/comments` |
| PATCH | `/admin/comments/:id/approval` |
| DELETE | `/admin/comments/:id` |
| GET, POST | `/admin/notifications` (+ `:id/read`, `read-all`) |

---

## 5. Data model (high level)

Table names follow the **legacy method-commerce** schema (it began on MySQL; the API now runs on PostgreSQL, with one baseline migration). Hand-written SQL quotes camelCase columns (`"orderId"`) because Postgres folds unquoted names to lower case. The variant/inventory side is a redesign (stock is no longer part of a variant’s identity).

```
user ──┬── user_profile
       ├── user_address ── province / city
       ├── user_favorite ── product
       ├── comment
       ├── basket ── basket_item ── product_variant
       ├── order ── order_item
       │         └── payment ── payment_gateway_ref
       └── notification

admin ── comment, notification

category (tree via parentId + materialized `path`)
brand
product ── product_image
        ├── product_option ── product_option_value
        └── product_variant ── variant_option_value
                            └── inventory_level ── inventory_location
```

**Important catalog rule:** a product declares option axes (color, size, …). Every variant must answer **every** option exactly once. Duplicate combinations are rejected via `option_signature`.

**Inventory:** availability = `on_hand - reserved`. Reservation happens at **order create**, not when the basket changes.

**Order snapshots:** line product details and the delivery address are frozen as JSON so later catalog/address edits do not rewrite history.

---

## 6. Flows

### 6.1 Customer authentication

```
Client                    API                         Redis / SMS
  │  POST /auth/otp/request     │
  │  { phone_number }           │
  │────────────────────────────►│  ensure user row exists
  │                             │  generate OTP
  │                             │──────────► store code (TTL ~2 min)
  │                             │──────────► send SMS (Kavenegar or console)
  │  { phoneNumber, expiresAt } │
  │◄────────────────────────────│
  │
  │  POST /auth/otp/verify
  │  { phone_number, otp_code } │
  │────────────────────────────►│  consume OTP (single-use)
  │                             │  confirm phone, activate account
  │                             │  issue access + refresh JWT (audience=user)
  │                             │  persist refresh token on user
  │  { accessToken, refreshToken, user }
  │◄────────────────────────────│
```

- Phone formats accepted: `09xxxxxxxxx`, `+989…`, `00989…`, Persian digits.
- In development, `OTP_EXPOSE_IN_RESPONSE=true` can echo the code in the request response.
- Refresh: `POST /auth/refresh` only succeeds if the token matches the one stored on the user.
- Logout revokes the refresh token; the access token lives until its TTL (default 1 day).
- `JwtAuthGuard` re-loads the user on every request so a deactivated account is locked out immediately.
- Customer tokens with `audience: user` are rejected on admin routes, and vice versa.

Admin login is email + bcrypt password → JWT with `audience: admin` (default 12h). Password reset uses a token emailed via Nodemailer.

Roles:

- Customers: `user`, `partner_legal`, `partner_real` (maps to `NORMAL` / `HOQOOQI` / `HAGHIGHI`)
- Admins: `admin` (super), `operator`, `delivery`

### 6.2 Catalog (admin writes, storefront reads)

```
Admin creates category tree (parent + sibling position → materialized path)
  → creates brand
  → creates product (draft or published)
  → PUT options (axes + values)  — locked once variants exist
  → POST variants (SKU, option combo, price/sale_price, stock per location)
Storefront GET /products?category_slug=&brand_slug=&price_min=&sort=
  → only published products, with cheapest-active-variant price
GET /products/:slug
  → options, variants, images, available quantity
```

Storefront filters: product id, title/search, category (including subtree via `path`), brand, price range, min available quantity. Sort: newest, oldest, title, price.

### 6.3 Basket

One basket per user. Lines point at **variants** so checkout does not re-resolve options.

```
POST /users/me/basket/items     { variant_id, quantity }
PATCH .../items/:variantId      { quantity }   // 0 removes the line
POST .../items/:variantId/increase|decrease
DELETE .../items/:variantId
DELETE /users/me/basket         // clear
GET /users/me/basket            // lines + issues (out of stock, unpublished, …)
```

Stock is **checked** when quantities change, but **not reserved** until an order is placed. `GET` reports per-line `issues` so the client can block checkout.

### 6.4 Checkout and order lifecycle

```
                    ┌─────────────┐
     checkout       │   PENDING   │◄──── COD or ONLINE
                    │  RESERVED   │
                    └──────┬──────┘
           cancel / timeout│      │
                           │      │ COD: admin confirm-payment
                           │      │ ONLINE: Zibal verify + fulfill
                           ▼      ▼
                    ┌──────────┐  ┌──────────┐
                    │CANCELLED │  │   PAID   │
                    │ RELEASED │  │ CONSUMED │
                    └──────────┘  └────┬─────┘
                                       │ admin complete
                                       ▼
                                  ┌───────────┐
                                  │ COMPLETED │
                                  └───────────┘
```

**Place order** (`POST /orders`):

1. Load basket; reject if empty or any line has issues.
2. Require a delivery address owned by the customer.
3. In a DB transaction:
   - lock the basket
   - copy lines into `Order` (snapshot product + unit price)
   - allocate `ORD-YYYYMMDD-00042`
   - **reserve** stock (`inventory_level.reserved += qty`)
   - persist order, **clear basket**
4. If payment method is `ONLINE`, schedule an unpaid-cancel job (default **15 minutes**). If scheduling fails, the order is cancelled immediately.
5. Notify customer + all admins (`order.created`).

**Preview** (`POST /orders/preview`) does the same validation without writing. `shipping_fee` is currently `0`.

**Cancel** (customer or admin, pending only): release reserved stock, notify.

**COD paid** (`POST /admin/orders/:id/confirm-payment`): mark PAID, **consume** stock (`on_hand` and `reserved` both down).

**Complete** (`POST /admin/orders/:id/complete`): PAID → COMPLETED (delivered).

### 6.5 Online payment (Zibal)

Requires Redis/BullMQ (`REDIS_ENABLED` / `REDIS_URL`). Online checkout is refused if jobs are off.

```
Customer                 API                      Zibal
  │ POST /orders { payment_method: ONLINE }
  │◄── PENDING order, stock reserved, 15 min timer
  │
  │ POST /orders/:id/payments
  │ Header: Idempotency-Key
  │──────────────────────────────────────────────► requestPayment
  │◄── { redirectUrl, gatewayRef }
  │
  │ browser ─────────────────────────────────────► Zibal checkout page
  │                         callback
  │ GET /payments/callback?trackId=…
  │   1. parse callback (ignore success=0 as truth)
  │   2. verifyPayment with Zibal (source of truth)
  │   3. commit payment SUCCEEDED in its own TX
  │   4. fulfill: mark order PAID, consume stock
  │   5. cancel the unpaid timer
  │   6. redirect frontend /orders/:id?payment=success|failed|refund-pending
```

Payment design notes:

- **Idempotency-Key** is unique. Retries with the same key return the same intent; a different key while one is in flight is a 409.
- Capture is committed **before** local fulfillment. If stock cannot be consumed, the payment stays SUCCEEDED and is flagged **refund-required** (`?payment=refund-pending`). Operators must refund; a later callback retries fulfillment.
- If the unpaid job cancelled the order **before** a late successful capture, fulfillment **revives** the order and re-reserves stock.
- Every Zibal `trackId` is stored on `payment_gateway_ref` so a late callback on an old tab still settles after a retry issued a new trackId.
- A **payment inquiry** worker (default every 60s) verifies open INITIATED/FAILED payments and retries unfulfilled captures — covers customers who never return from Zibal.

### 6.6 Comments

```
Customer POST /products/:id/comments   → published = false (moderation queue)
Admin    POST /admin/products/:id/comments → published = true immediately
Admin    GET  /admin/comments/pending
Admin    PATCH /admin/comments/:id/approval  { published }
Storefront GET /products/:slug/comments      → published only
```

- One level of replies (`parentId`). Replies-to-replies are rejected.
- Optional 1–5 rating on **root** comments only.
- Images uploaded to `uploads/comments/` and served statically.
- Customers may only reply to already-visible comments.

### 6.7 Notifications

Other modules inject `Notifications` and call `sendNotification({ context, type, recipients })`. Recipients can be a user, an admin, or **all active admins**.

Currently wired from ordering:

| Type | When |
|---|---|
| `order.created` | Checkout succeeded |
| `order.cancelled` | Customer, admin, or unpaid timeout |
| `order.paid` | Zibal capture fulfilled or COD confirmed |
| `order.completed` | Admin marked delivered |

Inboxes: `GET /users/me/notifications` and `GET /admin/notifications`.

### 6.8 Background jobs (optional module)

`OrderingJobsModule` loads only when Redis is enabled. In production, jobs **must** be on (`assertProductionOrderingJobs`).

| Queue | Worker | Purpose |
|---|---|---|
| Unpaid-order | `CancelUnpaidOrderProcessor` | After `ORDER_UNPAID_CANCEL_DELAY_MS` (15 min), cancel still-PENDING ONLINE orders and release stock |
| Payment inquiry | `InquireOpenPaymentsProcessor` + scheduler | Poll Zibal for payments the customer never redirected back from |
| Order SMS | `SendOrderSmsProcessor` | Order placed, paid, shipped, delivered, cancelled texts with retries |

In-process background work (no Redis needed):

- **Search indexing**: `SearchIndexerService` re-indexes changed products (debounced) on `catalog.changed` and comment events, rebuilds on start-up (`SEARCH_REINDEX_ON_BOOT`) and every `SEARCH_REFRESH_MINUTES` for stock and sales changes no event reports. Meilisearch rebuilds swap indexes, so searches never see a half-built one.
- **Stock alerts**: `StockAlertNotifier` runs after catalog/stock changes and every 5 minutes; each alert is claimed in the database before its SMS, so several API instances never text twice.
- **Freshness**: `CatalogFreshnessListener` bumps the `catalog` response-cache version and, when configured, calls the storefront's `/api/revalidate`.

`catalog.changed` comes from `CatalogChangeInterceptor`, which maps every successful admin write under `/admin/products`, `/admin/categories`, `/admin/brands` and `/admin/stock` to the products it touched.

---

## 7. Cross-cutting behavior

**Request pipeline**

```
RequestIdMiddleware → ThrottlerGuard → route guards (JWT / Admin / Roles)
  → ValidationPipe (whitelist + forbid extra fields → InvalidInputError)
  → LoggingInterceptor
  → controller / use case
  → AllExceptionsFilter
```

**Auth guards** (exported by Identity so other modules reuse them):

- `JwtAuthGuard` — customer access token, `audience=user`
- `AdminAuthGuard` — admin access token, `audience=admin`
- `RolesGuard` + `@Roles(...)` — e.g. only super admin creates accounts
- `MinAuthLevelGuard` — identity-verification tier (available, not currently applied on routes)

**Integrations (ports → adapters)**

| Port | Adapter |
|---|---|
| `TOKEN_SERVICE` | JWT (`JwtTokenService`) |
| `PASSWORD_HASHER` | bcrypt |
| `OTP_CHALLENGE_STORE` | Redis (in-memory fallback in tests) |
| `SMS_SENDER` | Kavenegar or console |
| `MAIL_SENDER` | Nodemailer |
| `PAYMENT_GATEWAY` | Zibal |
| `OBJECT_STORAGE` / `IMAGE_UPLOADER` | local disk |
| `EVENT_PUBLISHER` | Nest EventEmitter (`@OnEvent`) |

**Uploads** are served from `UPLOAD_ROOT_DIR` at `UPLOAD_PUBLIC_PATH` (ServeStatic).

---

## 8. Running it

```bash
# infrastructure
docker compose up -d postgres redis meilisearch

# app
cp .env.example .env   # DATABASE_URL, JWT_SECRET, ZIBAL_MERCHANT, …
npm install
npx prisma migrate deploy
npm run seed           # provinces/cities, a customer, an operator, sample catalog
npm run start:dev      # http://localhost:4000/api/docs
```

Useful env:

| Variable | Role |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (`postgresql://…`) |
| `JWT_SECRET` | min 16 chars |
| `OTP_TTL_SECONDS` | default 120 |
| `OTP_EXPOSE_IN_RESPONSE` | echo OTP in API (dev only) |
| `SMS_DRIVER` | `console` \| `kavenegar` |
| `REDIS_URL` / `REDIS_ENABLED` | OTP store + payment jobs |
| `ZIBAL_MERCHANT` | required outside tests |
| `ZIBAL_CALLBACK_URL` | defaults to `{SERVER_URL}/{API_PREFIX}/payments/callback` |
| `FRONTEND_URL` | where Zibal callback redirects the browser |
| `ORDER_UNPAID_CANCEL_DELAY_MS` | default 900000 (15 min) |

Docker production image: `npx prisma migrate deploy && node dist/main.js`. Volumes persist `uploads/` and `logs/`.

A Postman collection lives in `postman/`.

---

## 9. What a client should implement (happy paths)

**Storefront shopper**

1. OTP request → verify → store tokens  
2. Browse categories / products  
3. Add variant to basket; keep reading basket `issues`  
4. Create an address (need province + city ids)  
5. `POST /orders/preview` then `POST /orders`  
6. If `ONLINE`: `POST /orders/:id/payments` with `Idempotency-Key` → open `redirectUrl`  
7. Land on `{FRONTEND_URL}/orders/:id?payment=success|failed|refund-pending`  
8. Poll orders / notifications  

**Operator**

1. `POST /admin/auth/login`  
2. Manage catalog (category → brand → product → options → variants + stock)  
3. Moderate comments  
4. For COD: confirm payment when cash is collected, then complete when delivered  
5. Watch admin notifications for new/paid/cancelled orders  

---

## 10. Deliberate current limits

These are encoded in the code, not accidental:

- One promotion per order: a coupon never stacks with a campaign.
- A favorite is one per product; it can remember a variant, but the same product cannot be saved twice in two variants.
- Search without `MEILISEARCH_URL` is in memory: word-prefix matching, no typo tolerance, one process.
- Cached public reads can show stock up to 60 seconds old; the basket and checkout always check live stock.
- Only Zibal is integrated; there is no fallback gateway.
- Comments have a **single** reply level.
- Online payments depend on Redis + BullMQ being up.
- Location seed is a small Tehran/Isfahan/Fars fixture; production should import the full national list.
- `MinAuthLevel` exists for stepped identity verification but is not wired onto routes yet.
- Notification types are currently only the ordering lifecycle; the port is ready for other contexts.
