# Geo-IP Enrichment: Data Source and Privacy Decision

Status: **Decision record** — captures the data-source, privacy, and client-IP
decisions for resolving `country`/`city` from the request IP (issue #93, split
from #92). No behaviour is changed by this document; it records the decisions
that constrain the two implementation follow-ups (#94 spec fields, #95 eventsink
implementation).

## Background and current state

A customer using the web SDK asked for geo location (country and city) on their
stored analytics data, resolved by the eventsink from the incoming request IP so
nothing changes in the player (#92). That request was broken out by triage into
three units: this decision (#93), an EPAS spec change (#94), and the eventsink
implementation (#95).

What the code does today, grounded in the source:

- The eventsink ingests EPAS events, validates them against the
  `@eyevinn/player-analytics-specification` schema (`lib/Validator.ts`), and
  forwards them to a queue via `lib/Sender.ts`. `Sender` performs **no
  enrichment** — it only enqueues the object it is handed.
- There is already a precedent for a **server-derived field attached before
  forwarding**: `domain`. `attachDomainFromOrigin`/`deriveDomainFromOrigin`
  (`lib/route-helpers.ts`) derive `domain` from the request `Origin` header and
  attach it in place to the event in both routes before `sender.send(...)` —
  the `/` POST handler (`services/fastify.ts`, in the `fastify.post("/")`
  handler) and per converted event on the `/cmcd` handler. Country/city should
  follow this exact pattern: derive in a helper, attach before send.
- **No geo, country, city, or IP-handling code exists anywhere in the repo
  today** (confirmed by searching `lib/`, `services/`, `types/`, `spec/`).
- The `metadata` EPAS event is the carrier the customer wants enriched. Its
  payload is defined in the specification with `additionalProperties: false`, so
  `country`/`city` cannot be represented on it until the spec adds them (#94).

## 1. Geo-IP data source — **offline database file (MMDB format)**

**Decision: ship an open-licensed offline geo-IP database in the MMDB binary
format and look up locally. Do not call an external lookup API.**

| Criterion | Offline MMDB file (CHOSEN) | External lookup API (rejected) |
|-----------|----------------------------|--------------------------------|
| IP exposure | IP never leaves the service — lookup is in-process. | Request IP is sent to a third party on every lookup. Fails the "no IP to a third party" requirement from #92. |
| Licensing | Use a database published under an open license (e.g. a Creative-Commons-style / open-data license) that permits redistribution in a container image. Record the license and attribution the chosen database requires. | Commercial API terms, per-call or per-seat; redistribution not applicable but ToS/retention terms apply. |
| Distribution in Docker image | The `.mmdb` file is copied into the image at build time and read from disk. `.dockerignore` only excludes `node_modules/` and `build/`, so an added data file under a known path is already included by `COPY --chown=node:node . .` in the `Dockerfile`. Add the file to the `files` array in `package.json` only if it must also ship in the npm package; it is not needed for the container. | No file to distribute, but adds a hard runtime dependency on an external network endpoint and its availability. |
| Update cadence | Databases of this kind refresh roughly weekly/monthly. Refresh is a rebuild-and-redeploy (or a mounted volume) — acceptable because country/city granularity changes slowly. Document the refresh step. | Always current, but at the cost of the exposure/latency/cost above. |
| Latency | Microsecond-to-low-millisecond in-process lookup; no added network hop on the hot path (events already flow through the memory queue in `lib/Sender.ts`). | Adds a network round-trip per event (or requires a local cache that reintroduces the offline trade-offs). Unacceptable on a high-throughput ingest path. |
| Cost | One-time file size in the image (tens of MB); no per-request cost. | Per-request or subscription cost that scales with event volume. |

To keep the file path configurable, read the database location from an env var
(e.g. `GEOIP_DB_PATH`) with a sensible default baked into the image. The
reader library chosen in #95 must be MIT/BSD/Apache-compatible to match the
repo's MIT license (`package.json` `"license": "MIT"`).

> No commercial brand is named here on purpose. "An open-licensed offline
> geo-IP database in the MMDB format" describes the category; #95 picks the
> specific open-licensed database and reader, records its license, and adds the
> required attribution.

## 2. Privacy

- **Raw IP is never stored or forwarded.** The IP is used only as the transient
  input to the local lookup and is then discarded. It is never written to the
  event object, never enqueued, and never logged. Only the resolved `country`
  and `city` (coarse geo) reach the queue. This mirrors how `domain` is the only
  value derived-and-attached today — the source header is not forwarded, only
  the derived field.
- **Omit on private/unresolvable IP.** When the client IP is a private/loopback/
  link-local/reserved address, is missing, or does not resolve in the database,
  **omit `country` and `city` entirely** — never emit an empty string or a
  placeholder. This matches the existing `domain` contract in
  `deriveDomainFromOrigin`, which returns `undefined` so the caller omits the
  field. Because the spec marks these fields optional (#94) and the metadata
  payload is `additionalProperties: false`, omission is the only valid "unknown"
  representation.
- **Opt-out env var.** Enrichment must be switchable off without a code change.
  Add a boolean env var — recommended `GEOIP_ENABLED` (default **off**, so geo
  enrichment is opt-in and no deployment starts resolving IPs until an operator
  turns it on). When disabled, the lookup is skipped and no geo fields are added.
  Document it alongside the existing env vars in `README.md` and `dotenv.template`
  (which today list `QUEUE_TYPE`, `HEARTBEAT_INTERVAL`, `CORS_ALLOWED_ORIGINS`,
  `DISABLE_MEMORY_QUEUE`, AWS/SQS/Redis settings).
- **GDPR/PII README text needed.** The README must gain a short privacy note
  stating that: enabling geo enrichment processes the client IP to derive coarse
  location; the IP is processed transiently in-memory and never stored, logged,
  or forwarded; only country/city are retained; an operator enabling it is the
  data controller and is responsible for a lawful basis and for disclosing the
  processing in their own privacy policy; and the feature is off by default and
  can be disabled with the opt-out env var. Keep the wording factual; it belongs
  with the implementation PR (#95) so docs and behaviour land together.

## 3. Client IP extraction — honor `X-Forwarded-For` behind a trusted proxy

**Confirmed from the code:** the Fastify instance is created with
`export const fastify = require("fastify")();` in `services/fastify.ts` — **no
options object, so `trustProxy` is not set** (Fastify defaults it to `false`).
With `trustProxy` false, `request.ip` is the socket peer address and
`X-Forwarded-For` is ignored. Behind the OSC load balancer / any reverse proxy,
the socket peer is the proxy, so without a change every lookup would resolve the
proxy's location, not the viewer's.

**Decision:**

- Enable `trustProxy` when constructing Fastify, driven by config rather than
  hard-coded `true` (trusting `X-Forwarded-For` unconditionally lets a client
  spoof its IP). Recommended: a `TRUST_PROXY` env var passed through to the
  Fastify `trustProxy` option, accepting the forms Fastify supports — `true`,
  an integer hop count, or a comma-separated IP/CIDR allow-list of known
  proxies. Default **off** to preserve current behaviour until an operator
  configures their proxy topology.
- With `trustProxy` configured, take the client IP from `request.ip` (Fastify
  resolves it from `X-Forwarded-For` per the trust setting) — do not parse the
  header by hand.
- **Lambda/ALB path (`services/lambda.ts`) is separate.** That handler is not a
  Fastify server; it already reads headers directly (e.g. `event.headers['host']`).
  If geo is wanted on the ALB path too, #95 must read the client IP from
  `event.headers['x-forwarded-for']` there explicitly. Recommend scoping #95 to
  the Fastify path first and treating the Lambda path as a follow-up.

## 4. Prior requests — none older than #92

Searched every issue in `Eyevinn/player-analytics-eventsink` (open and closed,
#1–#95). The only geo/country/city/IP-location request is **#92**
("Eventsink: add country and city to events, resolved from the request IP",
2026-10-01), which is the origin of this work and is now closed/broken out into
#93 (this decision), #94 (spec), and #95 (implementation). The customer thought a
colleague might have raised it earlier; **no older duplicate exists**. The
nearest-sounding older issue, #7 ("Get host header from request and include in
queue message"), is about the `host`/`Origin` header, not geo-IP, and is
unrelated. **No duplicate to link or close beyond #92.**

## How this constrains the follow-ups

- **#94 (EPAS spec):** add `country` and `city` as **optional** string fields on
  the `metadata` event payload in `Eyevinn/player-analytics-specification`. They
  must be optional because they are omitted on private/unresolvable IPs and when
  enrichment is disabled, and the payload is `additionalProperties: false` so
  they cannot appear until the schema allows them. The spec bump then propagates
  to the three client SDKs (web/android/swift) and to the eventsink's pinned
  `@eyevinn/player-analytics-specification` dependency. The SDKs do not set these
  fields — they are server-derived only — but the schema must accept them.
- **#95 (eventsink implementation):** depends on #94 landing and the dependency
  being bumped (validation rejects unknown fields otherwise). Implement a
  geo-lookup helper in `lib/route-helpers.ts` mirroring
  `attachDomainFromOrigin` (derive → attach-in-place → omit on unknown), call it
  before `sender.send(...)` in the `/` and `/cmcd` handlers, bundle the
  offline MMDB database, add `GEOIP_ENABLED` (default off), `GEOIP_DB_PATH`, and
  `TRUST_PROXY` env vars, wire `trustProxy` into the Fastify constructor, and add
  the GDPR/PII note to the README plus the new vars to `dotenv.template`. Store
  or log the raw IP nowhere.
