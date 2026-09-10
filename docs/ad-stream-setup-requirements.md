# Ad-Stream Setup Task — Requirements Clarification

Status: **Requirements note** — resolves the clarification chore in issue #80
(split from #50, which had an empty body and could not be actioned). This
document changes no behaviour; it captures what — if anything — the "ad-stream
setup task" implies for `player-analytics-eventsink`, grounded in the code that
exists in this repo today, and proposes how to break the work down.

## 1. What this repo actually does (scope)

The eventsink is an **HTTP event-ingest service**. Its whole responsibility, per
the code, is: receive an EPAS event over HTTP, validate it against the EPAS JSON
schema, server-derive a small number of fields, and forward it to a processing
queue.

- HTTP surface: `services/fastify.ts` (`POST /`, `POST /cmcd`, `OPTIONS`,
  `GET /health`, and a catch-all in `fastify.route({ url: "/*" })`). A Lambda
  entry point exists in `services/lambda.ts` / `index.ts`.
- Validation: `lib/Validator.ts` compiles the schema re-exported from
  `resources/schema.ts`, which is literally
  `import schema from '@eyevinn/player-analytics-specification/json/schema.json'`.
  The validator resolves the pointer `#/definitions/TPlayerAnalyticsEvent`. The
  eventsink therefore **owns no event schema of its own** — the contract for
  what an event may contain lives entirely in the pinned
  `@eyevinn/player-analytics-specification` dependency (`0.6.0`, see
  `package.json`).
- Server-derived fields: `lib/route-helpers.ts` derives the EPAS `domain` from
  the request `Origin` header (`deriveDomainFromOrigin` / `attachDomainFromOrigin`)
  and echoes `sessionId` / `heartbeatInterval` back on `init`.
- Forwarding: `lib/Sender.ts` pushes to an SQS / beanstalkd / redis adapter from
  `@eyevinn/player-analytics-shared`, optionally buffered by the in-process
  `lib/MemoryQueue.ts`.

What the eventsink does **not** do: it does not originate ad breaks, stitch or
serve media, resolve ad decisions, parse VAST/VMAP, or fire tracking beacons.
There is no ad-server, manifest-manipulation, or stream-provisioning code
anywhere in the repo.

## 2. Where "ads" appear in the code today

Ads surface in exactly one place: the CMCDv2 ingest path
(`lib/CMCDv2Converter.ts`) maps CMCD event types to EPAS `metadata` events:

- `as` / `ae` → `metadata` with `payload.adEvent = "start" | "end"` and
  `payload.contentId`.
- `is` / `ie` → `metadata` with `payload.interstitialEvent = "start" | "end"`.
- `cc` → `metadata` with `payload.contentChange = true`.

These are **scalar** markers on the `metadata` payload. They validate today
because the `metadata` variant of the EPAS schema declares
`additionalProperties: { type: ["string", "number", "boolean"] }` — i.e. it
accepts arbitrary *scalar* extra keys, but not nested objects or arrays
(verified against `@eyevinn/player-analytics-specification` 0.6.0). This is the
only ad-awareness the ingest service has.

A separate, related design note already lives in this repo —
`docs/tracking-url-output-contract.md` (issue #78, split from #52) — but that
concerns an **Ad Normalizer service**, not the eventsink, and it explicitly
states that carrying nested ad/tracking structures on an EPAS event would first
require a spec change. That constraint is confirmed below.

## 3. Answers to the four clarifying questions

### Q1 — What concrete outcome is expected in `player-analytics-eventsink`?

**None, as an ingest-code change, from the information available.** The parent
issue #50 ("Setting up OSC SGAI stream with ads") is a **platform/stream setup
task** — provisioning a server-guided ad-insertion (SGAI) stream on Eyevinn
Open Source Cloud so that a player emits ad-related analytics. That is an
operational/configuration and documentation activity around *other* components
(the stream origin/packager, the ad-decision/normalizer service, and the client
SDK configuration), not a change to how the eventsink receives, validates, or
forwards events.

The eventsink already ingests the ad-related `metadata` events its clients can
send today (§2). No new endpoint, event type, config flag, or code path is
implied by "set up an ad stream" on its own.

### Q2 — Does it require a `player-analytics-specification` change that must propagate to the SDKs?

**Only if richer, structured ad data must travel on the event — and that is a
spec-owned decision, not an eventsink one.**

- The scalar ad markers already emitted (`adEvent`, `interstitialEvent`,
  `contentChange`) need **no** spec change: the `metadata` payload's scalar
  `additionalProperties` already admits them.
- Anything **structured** — e.g. a per-creative ad/tracking block like the `ads`
  array proposed in `docs/tracking-url-output-contract.md`, or a dedicated ad
  event type — **cannot be represented on an EPAS event without a change in
  `Eyevinn/player-analytics-specification`**, because nested objects/arrays fail
  the `metadata` payload's scalar-only `additionalProperties` constraint (and
  every non-`metadata` variant is `additionalProperties: false`). Such a change
  would be authored in the specification repo, then propagate to the three SDKs
  (web/android/swift) and be adopted here only by bumping the pinned
  `@eyevinn/player-analytics-specification` dependency in `package.json`.

The eventsink is a **downstream consumer** of the schema, never its author. So
the spec question is real but its answer lives outside this repo unless and
until a concrete structured-ad-field proposal exists.

### Q3 — Is this an eventsink code change at all, or guidance that belongs elsewhere?

**It is setup/documentation guidance that belongs elsewhere.** The deliverable
implied by #50 is "how to stand up an SGAI-with-ads stream and point the
analytics client at an eventsink" — i.e. platform setup steps plus client SDK
configuration. The eventsink's only role in that flow is to be a running
endpoint that receives the events the client already knows how to send. Setup
prose for provisioning the stream and the ad components does not belong in the
ingest service's codebase; at most, the eventsink docs can state the endpoint
contract the setup relies on (which the README and
`docs/tracking-url-output-contract.md` already cover for the ingest side).

### Q4 — Acceptance criteria and references.

Because the grounded outcome for **this** repo is "no ingest code change is
warranted from the current information", the acceptance criteria for closing the
clarification are documentation-level (see §4). References:

- `README.md` — service purpose, env vars, run instructions.
- `services/fastify.ts`, `lib/Validator.ts`, `resources/schema.ts` — the actual
  ingest/validate/forward path.
- `lib/CMCDv2Converter.ts` — the only ad-aware mapping in the repo.
- `docs/tracking-url-output-contract.md` — sibling ad design note (Ad Normalizer,
  #78/#52) and the same spec-propagation constraint.
- `@eyevinn/player-analytics-specification` 0.6.0
  (`json/schema.json`, `#/definitions/TPlayerAnalyticsEvent`) — the schema this
  service validates against.

## 4. Acceptance criteria for closing #80

This is a clarification chore; it is satisfied when:

1. This document exists and states the eventsink's ingest-only scope with the
   file-path evidence above. **[met by this file]**
2. Each of the four #80 questions has a repo-grounded answer. **[§3]**
3. The spec constraint (scalar-only `metadata` `additionalProperties`; nested ad
   structures need a spec change first) is recorded so no one re-derives it.
   **[§2, §3-Q2]**
4. A recommendation is recorded on whether #80 yields eventsink work, and any
   real follow-up is broken into independently-actionable sub-issues. **[§5]**

## 5. Recommendation and follow-up

**Recommendation: close #80 as clarified; no eventsink implementation issue is
warranted from the current information.** The parent task (#50) is an OSC
stream-setup activity that lives with the platform/stream and ad components and
with client-SDK configuration, not with the ingest service. The eventsink
already accepts the ad-related `metadata` events its clients can send.

Open eventsink sub-issues **only** if a concrete requirement lands that a
requester confirms. Candidate, each independently implementable:

- `feat:` (specification repo, prerequisite) — define a structured ad/tracking
  field on the `metadata` payload (or a dedicated ad event type). This is the
  gate for anything beyond scalar markers; without it the eventsink cannot carry
  structured ad data (§3-Q2). Overlaps with the direction in
  `docs/tracking-url-output-contract.md`.
- `chore:` (eventsink) — once such a spec version is published, bump the pinned
  `@eyevinn/player-analytics-specification` dependency in `package.json` and add
  a validation fixture proving the new ad shape ingests. Blocked by the above.
- `docs:` (eventsink, optional) — if the SGAI setup guide needs the ingest
  contract inline, add a short "events the eventsink accepts for ad reporting"
  section pointing at the CMCD ad mappings (§2). Only if a setup guide explicitly
  asks for it; otherwise setup prose belongs with the platform/setup docs, not
  here.

If none of the above is confirmed, there is no eventsink deliverable and #80 is
complete as a clarification.
