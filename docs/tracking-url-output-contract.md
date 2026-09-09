# Tracking-URL Output Contract (Ad Creative Enhancement)

Status: **Design note / proposal** — captures the contract for the ad creative
enhancement (issue #78, split from #52) so it can be implemented without ambiguity.
No behaviour is changed by this document; it is a specification for the follow-up
implementation work.

## Background and current state

The eventsink today ingests EPAS events (`event`, `sessionId`, `timestamp`,
`playhead`, `duration`, optional `payload`), validates them against the
`@eyevinn/player-analytics-specification` JSON schema (`resources/schema.ts`), and
forwards them to a queue. Ads currently appear only in two places:

- **CMCDv2 conversion** (`lib/CMCDv2Converter.ts`) maps the CMCDv2 `as`/`ae`
  (ad start/end) and `is`/`ie` (interstitial start/end) event types to EPAS
  `metadata` events carrying an internal `adEvent: "start" | "end"` (or
  `interstitialEvent`) plus `contentId` in the payload.
- The EPAS `metadata` event payload defined in the specification (fields:
  `contentId`, `contentTitle`, `contentUrl`, `customMetadataId`, `deviceId`,
  `deviceModel`, `deviceType`, `drmType`, `live`, `userId`).

There is **no VAST/VMAP parsing and no tracking-URL handling anywhere in this
repo today**. This note defines the contract for adding one.

> Important schema constraint: every EPAS event variant in the specification is
> declared with `additionalProperties: false`, and the `metadata` payload does
> **not** currently include any ad-tracking fields. Therefore the tracking-URL
> output described below **cannot be represented on an existing EPAS event
> payload without a corresponding change in
> `Eyevinn/player-analytics-specification`** that then propagates to the three
> client SDKs (web/android/swift). See "Spec propagation" below.

## 1. Tracking-URL categories to surface

The contract covers the IAB VAST tracking-event categories. Grouped as:

| Group | Category keys |
|-------|---------------|
| Impression | `impression` |
| Quartile / progress | `start`, `firstQuartile`, `midpoint`, `thirdQuartile`, `complete` |
| Interaction | `clickThrough`, `clickTracking` |
| Lifecycle / state | `pause`, `resume`, `mute`, `unmute`, `skip`, `closeLinear` |
| Error | `error` |

Rules:
- Category keys are a fixed, closed enum (camelCase as above). Unknown VAST
  `event` attribute values are dropped (not surfaced under an arbitrary key) so
  the output stays schema-stable.
- `clickThrough` is the navigation destination; `clickTracking` are the beacons
  fired on click. They are kept distinct.
- `error` URLs are surfaced separately from EPAS player `error`/`warning`
  events — these are ad-server error beacons, not player diagnostics.

## 2. Response schema / field names and attachment

Tracking data attaches **per creative**, because VAST tracking events are defined
at the creative (`<Linear>`/`<NonLinear>`) level and a single ad may carry
multiple creatives. Creatives are grouped **per ad** so wrapper-vs-inline
ownership is preserved.

Proposed shape (a new `ads` structure carried on the ad-related `metadata`
payload; field names chosen to avoid colliding with the existing `metadata`
payload keys listed above):

```jsonc
{
  "event": "metadata",
  "sessionId": "…",
  "timestamp": 0,
  "playhead": 0,
  "duration": 0,
  "payload": {
    "contentId": "…",          // existing field, unchanged
    "adEvent": "start",         // existing internal marker, unchanged
    "ads": [                     // NEW
      {
        "adId": "…",            // VAST <Ad id> (empty string if absent)
        "system": "…",          // <AdSystem> value, optional
        "wrapper": false,        // true if this ad came from a wrapper redirect
        "creatives": [
          {
            "creativeId": "…",  // VAST <Creative id> (empty string if absent)
            "sequence": 1,        // optional, from <Creative sequence>
            "trackingUrls": {
              "impression": ["https://…"],
              "start": ["https://…"],
              "firstQuartile": [],
              "midpoint": [],
              "thirdQuartile": [],
              "complete": [],
              "clickThrough": ["https://…"],
              "clickTracking": [],
              "error": []
            }
          }
        ]
      }
    ]
  }
}
```

Field-name rules:
- `ads` is an array of ad objects; each ad has `creatives` (array).
- `trackingUrls` is an object keyed by the category enum in §1; **every** category
  key is always present, its value an array (empty when no URL — see §4).
- New keys (`ads`, `adId`, `creatives`, `creativeId`, `trackingUrls`, …) are
  additive and namespaced under `ads[]` so they never collide with existing
  `metadata` payload fields.

## 3. Input source and parsing scope

- **Input**: VAST 3.0 and VAST 4.x documents. VMAP is supported only as an outer
  envelope: the parser reads `<vmap:AdBreak>` entries and extracts the VAST
  `<AdSource>` inline data within them; VMAP-level tracking
  (`<vmap:TrackingEvents>` such as `breakStart`/`breakEnd`) is **out of scope**
  for the first iteration and, if added later, would be surfaced per-ad-break,
  not per-creative.
- **Inline vs. wrapper**: wrappers are followed to a configurable max depth
  (default 5). Tracking URLs from every wrapper in the chain plus the final
  inline ad are **merged** into the resulting creative(s); wrapper-sourced ads
  are marked `"wrapper": true`.
- **Macro substitution**: URLs are surfaced **as authored**, with VAST macros
  (e.g. `[CACHEBUSTING]`, `[ERRORCODE]`) left intact. Substitution is the
  responsibility of the beacon-firing consumer, not the eventsink. This keeps the
  eventsink free of request-time state it does not own.

## 4. Normalization rules

- **Dedup**: within a single category array on a single creative, exact-string
  duplicate URLs are removed; order of first occurrence is preserved.
- **Ordering**: categories appear in the fixed §1 order; within a category, URLs
  keep source-document order (after dedup).
- **Missing/empty**: a category with no URLs is represented as an **empty array**,
  never omitted and never `null`. An ad with no parseable creatives yields an ad
  object with `creatives: []`. If VAST parsing fails entirely, `ads` is omitted
  and a warning is logged — the underlying player event is still forwarded.
- **Whitespace/trimming**: URLs are trimmed; empty-after-trim entries are dropped.

## 5. Backward compatibility

- The `ads` structure is **purely additive**. Existing creative-only / non-ad
  consumers that read the current `metadata` payload fields are unaffected because
  no existing field changes type or meaning.
- When no ad/tracking data is present, no `ads` key is emitted, so today's payload
  shape is byte-for-byte unchanged for non-ad events.
- Because the EPAS schema is `additionalProperties: false`, shipping `ads` on the
  `metadata` payload requires the spec change described next; until that lands,
  emitting `ads` would fail validation. Implementation MUST NOT enable `ads`
  output ahead of the spec version that defines it.

## Spec propagation

Adding the `ads` payload block is a coordinated change:

1. `Eyevinn/player-analytics-specification` — add the `ads` shape to the
   `metadata` event payload and bump the schema version.
2. `player-analytics-eventsink` — bump the `@eyevinn/player-analytics-specification`
   dependency, implement the VAST/VMAP parser and normalization producing the
   shape above.
3. Client SDKs (`web`, `android`, `swift`) — adopt the new payload fields as
   needed for their own ad reporting.

## Acceptance criteria for the implementing issue

- A parser converts VAST 3/4 (and VMAP-enveloped VAST) into the §2 shape.
- All §1 categories are populated correctly from a fixture VAST document,
  including merged wrapper+inline tracking.
- Normalization (§4) verified by unit tests: dedup, ordering, empty-array
  representation, macro passthrough.
- Non-ad events emit an unchanged payload (backward-compat test).
- Output validates against the updated EPAS schema version.
