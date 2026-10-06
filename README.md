[![Slack](https://slack.osaas.io/badge.svg)](https://slack.osaas.io)

# Eyevinn Open Analytics Eventsink

> _Part of Eyevinn Open Analytics Solution_

[![Badge OSC](https://img.shields.io/badge/Evaluate-24243B?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8yODIxXzMxNjcyKSIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI3IiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiLz4KPGRlZnM%2BCjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQwX2xpbmVhcl8yODIxXzMxNjcyIiB4MT0iMTIiIHkxPSIwIiB4Mj0iMTIiIHkyPSIyNCIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjQzE4M0ZGIi8%2BCjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzREQzlGRiIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM%2BCjwvc3ZnPgo%3D)](https://app.osaas.io/browse/eyevinn-player-analytics-eventsink?utm_source=github&utm_medium=readme&utm_campaign=analytics)

Eyevinn Open Analytics is an open source solution for tracking events from video players. Based on the open standard Eyevinn Player Analytics ([EPAS](https://github.com/Eyevinn/player-analytics-specification/tree/main)) it enables a modular framework where you are not locked in with a specific vendor. This is the eventsink module that receives and validate the data from the players and push the data on to a processing quque.

## Hosted Solution

Available as a hosted service on [Open Source Cloud](https://analytics.apps.osaas.io?utm_source=github&utm_medium=readme&utm_campaign=analytics) if you prefer not to manage the infrastructure yourself. Read the [documentation](https://docs.osaas.io/osaas.wiki/Service%3A-Player-Analytics-Eventsink.html) to get started.

## Development

The simplest way to run an eventsink locally is to use the fastify service, by running `npm start`. This will spin up a local server at port 3000 which you can use as eventsink url in your [Eyevinn Player Analytics Client SDK](https://github.com/Eyevinn/player-analytics-client-sdk-web) project. You may as well specify your environment variables as the standard specifies.

e.g. `QUEUE_TYPE=redis npm start` will start a `fastify` service towards your local `redis` as queue.

## Environment Variables

```bash
QUEUE_TYPE = "<SQS | beanstalkd | redis>"
HEARTBEAT_INTERVAL = "<heartbeat-interval>"
CORS_ALLOWED_ORIGINS = "<comma-separated-list-of-origins-to-allow>"
# When unset, responses use a wildcard `Access-Control-Allow-Origin: *` (an open, any-browser-origin ingestion endpoint) and a startup warning is emitted; set it to restrict which browser origins may POST events.

# Memory Queue (enabled by default for improved performance)
DISABLE_MEMORY_QUEUE = "<true to disable, false or unset for enabled>"

# AWS (Lambda & SQS) specifics
AWS_REGION = "<your-aws-region>"
# SQS specifics
SQS_QUEUE_URL = "<your-sqs-queue-url>"

# Redis specifics
REDIS_HOST = "<default localhost>"
REDIS_PORT = "<default 6379>"
REDIS_PASSWORD = "<default empty>"

# Geo-IP enrichment (optional, OFF by default)
GEOIP_ENABLED = "<true to resolve country/city from the request IP; default off>"
GEOIP_DB_PATH = "<path to the offline geo-IP database file (MMDB format)>"
# Trust X-Forwarded-For so the real client IP can be read behind a proxy / load
# balancer. One of: false (default) | true | <integer hop count> | a
# comma-separated list of trusted proxy IPs/CIDRs.
TRUST_PROXY = "<false | true | integer-hops | ip/cidr,ip/cidr>"
```

## Geo-IP Enrichment

The eventsink can resolve a coarse geo location — `country` (ISO 3166-1 alpha-2,
e.g. `SE`) and `city` — from the client IP of each request and attach it to
`metadata` events before they are queued. The fields are server-derived (the
player/SDKs never send them) and are defined as optional fields on the metadata
event in the [EPAS specification](https://github.com/Eyevinn/player-analytics-specification).

The feature is **off by default** and is enabled with `GEOIP_ENABLED=true`.

### How it works

- Lookups use an **offline geo-IP database file in the MMDB binary format**,
  read locally and in-process. The client IP is **never sent to any third
  party**. Point `GEOIP_DB_PATH` at the database file; the reader is the
  MIT-licensed `mmdb-lib` package. You must supply an open-licensed MMDB
  database yourself (mount it into the container or add it to the image) and
  comply with that database's own license and attribution requirements — none
  is bundled with this repository.
- Behind a reverse proxy or load balancer the real client IP is in the
  `X-Forwarded-For` header. Set `TRUST_PROXY` to your proxy topology so Fastify
  resolves `request.ip` from that header. It is `false` by default; leaving it
  unset means the socket peer (the proxy) would be looked up instead of the
  viewer.
- `country`/`city` are attached **only** to `metadata` events, and only after
  schema validation, so enrichment never changes whether an event is accepted.

### Privacy / GDPR note

When geo enrichment is enabled, the eventsink processes the client IP solely to
derive a coarse location. The IP is handled transiently in memory as lookup
input only — it is **never stored, logged, or forwarded**; only the resolved
`country`/`city` are retained. If the IP is private, loopback, reserved, or
cannot be resolved, both fields are omitted entirely (never emptied or
placeholdered). An operator who enables this feature is the data controller for
that processing and is responsible for having a lawful basis and for disclosing
it in their own privacy policy. The feature is off by default and can be turned
off at any time by unsetting `GEOIP_ENABLED`.

## Memory Queue

The eventsink includes a **memory queue feature enabled by default** that provides immediate responses to clients while processing events in the background. This reduces load on the primary queue system and improves response times.

For detailed configuration options and usage information, see [Memory Queue Documentation](MEMORY_QUEUE.md).

# About Eyevinn Technology

Eyevinn Technology is an independent consultant firm specialized in video and streaming. Independent in a way that we are not commercially tied to any platform or technology vendor.

At Eyevinn, every software developer consultant has a dedicated budget reserved for open source development and contribution to the open source community. This give us room for innovation, team building and personal competence development. And also gives us as a company a way to contribute back to the open source community.

Want to know more about Eyevinn and how it is to work here. Contact us at work@eyevinn.se!
