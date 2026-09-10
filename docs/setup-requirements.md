# Setup Documentation — Scope & Requirements

Status: **Requirements / scope note** — resolves issue #79 ("clarify scope and
requirements for the setup documentation"). This document does not add setup
documentation itself; it establishes, grounded in the code actually present in
this repository, what a "setup documentation" for the eventsink must cover and
splits the remaining work into concrete, implementable follow-up sub-issues.

## 1. What this service actually is

The eventsink is the **event-ingest module** of the Eyevinn Open Analytics
solution. Based on the code in this repo, its entire responsibility is:

1. Accept player-analytics events over HTTP.
2. Validate them against the EPAS JSON schema.
3. Server-derive the `domain` field from the request `Origin` header.
4. Forward valid events to a configured message queue for downstream processing.

Concretely, this is what the code does — nothing more:

- **HTTP surface** (`services/fastify.ts`): a Fastify server with
  `POST /` (ingest an EPAS event), `POST /cmcd` (ingest a CMCDv2 payload that is
  parsed and converted to EPAS events), `GET /health`, `OPTIONS` preflight
  handlers, and a catch-all that returns 404/405/400. There is also an AWS
  Lambda/ALB entry point (`services/lambda.ts`, re-exported from `index.ts`).
- **Validation** (`lib/Validator.ts`): compiles the EPAS schema
  (`resources/schema.ts`, which re-exports
  `@eyevinn/player-analytics-specification/json/schema.json`) with AJV and
  validates each event; invalid events get a 400 with per-field errors.
- **Domain derivation** (`lib/route-helpers.ts` — `deriveDomainFromOrigin` /
  `attachDomainFromOrigin`): sets EPAS `domain` from the `Origin` header.
- **Forwarding** (`lib/Sender.ts`): selects a queue adapter
  (`SqsQueueAdapter`, `BeanstalkdAdapter`, `RedisAdapter`) from
  `@eyevinn/player-analytics-shared` based on `QUEUE_TYPE`, and pushes events.
- **In-memory buffering** (`lib/MemoryQueue.ts`, documented in
  `MEMORY_QUEUE.md`): an on-by-default in-memory queue that answers clients
  immediately and drains to the real queue in the background.
- **CMCDv2 support** (`lib/CMCDv2Parser.ts`, `lib/CMCDv2Converter.ts`,
  `types/cmcdv2.ts`): parses CMCDv2 request data and converts it to EPAS events.

The eventsink **does not** store events, process them, or expose a query/read
API — it hands off to a queue. Processing is a separate module
(`player-analytics-worker`); the event/schema contract lives in
`player-analytics-specification`; clients emitting events are the
`player-analytics-client-sdk-*` repos.

## 2. Scope question raised in #79: "SGAI" and "Ad Normalizer"

Issue #79 asks whether "SGAI" and an "Ad Normalizer" belong in this repo.

Answer, grounded in the code: **no, neither concept exists in this service.**

- A repository-wide search finds no reference to server-guided ad insertion, to
  any "ad normalizer" component, or to VAST/VMAP/tracking-URL handling anywhere
  in the source.
- The only ad-adjacent behaviour in the repo is a narrow mapping inside
  `lib/CMCDv2Converter.ts`, which translates CMCDv2 ad-start/ad-end and
  interstitial-start/interstitial-end signals into EPAS `metadata` events. This
  is CMCDv2-to-EPAS event conversion, not ad insertion and not ad normalization.
  This is already described in `docs/tracking-url-output-contract.md`, which
  itself confirms there is "no VAST/VMAP parsing and no tracking-URL handling
  anywhere in this repo today."

Conclusion: a setup document for the eventsink must be scoped to **event ingest,
validation, and queue forwarding**. Any "SGAI"/ad-normalizer framing describes a
different concern entirely and does not belong in this service's setup docs. If
that framing came from the original umbrella issue (#51), it points at a separate
component/product surface, not at this event-ingest service — it should be
tracked against whichever repo actually owns that concern, not here. This
document proceeds on the event-ingest scope only.

## 3. What a setup documentation must cover (grounded)

Audience: an operator or integrator who wants to run the eventsink locally or
deploy it, and point a client SDK at it. Outcome: a running eventsink reachable
by a client SDK and forwarding to a queue.

The setup docs must cover the following, all of which have concrete backing in
the repo:

### 3.1 Prerequisites & install
- Node.js (the `Dockerfile` builds on `node:18-alpine`).
- Install with `npm ci` / `npm install`.
- Available scripts (`package.json`): `npm start`
  (`ts-node services/fastify.ts`), `npm test` (jasmine), `npm run build`
  (`tsc -p tsconfig-build.json`), `npm run lint`, `npm run bench`.

### 3.2 Running locally
- `npm start` starts Fastify on port `3000` by default (`services/fastify.ts`);
  the port is overridable via `PORT`. Host is bound to `0.0.0.0`.
- The README's stated pattern, e.g. `QUEUE_TYPE=redis npm start`.
- The `GET /health` endpoint and what its `memoryQueue` block reports.

### 3.3 Configuration reference (environment variables)
Documented from where each is actually read in the code, not invented:

- `QUEUE_TYPE` — `SQS` | `beanstalkd` | `redis` (`lib/Sender.ts`); with no valid
  value events are not forwarded.
- `HEARTBEAT_INTERVAL` — used in `generateInitResponseBody`
  (`lib/route-helpers.ts`), default `5000`.
- `CORS_ALLOWED_ORIGINS` — comma-separated allow-list
  (`generateResponseHeaders` in `lib/route-helpers.ts`); when unset, responses
  use wildcard `Access-Control-Allow-Origin: *` and a startup warning is emitted
  (`warnIfCorsAllowlistUnset` in `services/fastify.ts`). This is a security-
  relevant default and must be called out.
- `SEND_TIMEOUT_MS` — direct-send timeout (`getTimeoutMs`), default `3000`.
- `PORT` — HTTP port, default `3000` (`services/fastify.ts`).
- SQS: `AWS_REGION`, `SQS_QUEUE_URL`, `SQS_MAX_SOCKETS` (default 50 — see
  `dotenv.template` and `lib/Sender.ts`).
- Redis: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (README defaults
  localhost / 6379 / empty).
- Memory queue: `DISABLE_MEMORY_QUEUE`, `MEMORY_QUEUE_MAX_SIZE`,
  `MEMORY_QUEUE_BATCH_SIZE`, `MEMORY_QUEUE_DRAIN_INTERVAL`,
  `MEMORY_QUEUE_MAX_RETRIES`, `MEMORY_QUEUE_OVERFLOW_STRATEGY`,
  `MEMORY_QUEUE_EVENT_DELAY_MS`, `MEMORY_QUEUE_ADAPTIVE_THROTTLING`,
  `MEMORY_QUEUE_MAX_CONCURRENT` (all read in `lib/Sender.ts`; also in
  `MEMORY_QUEUE.md`).
- Note the drift to fix: `dotenv.template` currently lists only a subset of the
  above; the config reference should either be complete or `dotenv.template`
  brought in line.

### 3.4 Deployment
- Container build & run from the `Dockerfile` (note it sets `EXPOSE 8080` while
  the app defaults to `PORT`/3000 — this discrepancy needs to be documented or
  reconciled).
- The AWS Lambda/ALB entry point (`services/lambda.ts`, `index.ts`) as an
  alternative deployment target.
- Reference to the hosted option already linked from the README.

### 3.5 Integration
- The request/response contract of `POST /` and `POST /cmcd` (status codes and
  bodies are defined in `lib/route-helpers.ts`).
- How a client SDK points at the eventsink URL (README already sketches this).
- The EPAS schema/version coupling via
  `@eyevinn/player-analytics-specification` and the `X-EPAS-Version` response
  header.

### 3.6 Where the docs should live
- Format: Markdown, consistent with existing `README.md`, `MEMORY_QUEUE.md`, and
  `docs/tracking-url-output-contract.md`.
- Location: `docs/` for detailed guides, with the `README.md` linking out to
  them (as it already does for `MEMORY_QUEUE.md`).

## 4. Upstream references / existing partial docs

- `README.md` — partial setup, env var list, and hosted-service pointer.
- `MEMORY_QUEUE.md` — complete memory-queue configuration reference.
- `docs/tracking-url-output-contract.md` — related design note (CMCDv2/ad
  mapping); useful for the scope boundary in §2.
- `dotenv.template` — partial env var template (incomplete; see §3.3).
- `@eyevinn/player-analytics-specification` — the event schema the eventsink
  validates against; the authoritative event contract.

## 5. Proposed follow-up documentation sub-issues

Each is independently implementable and scoped to event ingest:

1. **Setup & local-development guide** (`docs/setup.md`): prerequisites, install,
   `npm start`, health check, and the minimal happy-path to a running eventsink
   forwarding to one queue. (§3.1–3.2)
2. **Configuration reference** (`docs/configuration.md`): the complete env-var
   table from §3.3, and reconcile `dotenv.template` so it matches. Includes the
   `CORS_ALLOWED_ORIGINS` wildcard-default security note.
3. **Deployment guide** (`docs/deployment.md`): container (Dockerfile) and
   Lambda/ALB targets, and reconcile the `EXPOSE 8080` vs default port 3000
   discrepancy. (§3.4)
4. **Integration guide** (`docs/integration.md`): `POST /` and `POST /cmcd`
   request/response contracts, EPAS version coupling, and pointing a client SDK
   at the eventsink URL. (§3.5)

Cross-cutting cleanup, can be folded into sub-issue 2: bring `dotenv.template`
in line with the full env-var set actually read by the code.
