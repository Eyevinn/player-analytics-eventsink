[![Slack](https://slack.osaas.io/badge.svg)](https://slack.osaas.io)

# Eyevinn Open Analytics Eventsink

> _Part of Eyevinn Open Analytics Solution_

[![Badge OSC](https://img.shields.io/badge/Evaluate-24243B?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8yODIxXzMxNjcyKSIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI3IiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiLz4KPGRlZnM%2BCjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQwX2xpbmVhcl8yODIxXzMxNjcyIiB4MT0iMTIiIHkxPSIwIiB4Mj0iMTIiIHkyPSIyNCIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjQzE4M0ZGIi8%2BCjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzREQzlGRiIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM%2BCjwvc3ZnPgo%3D)](https://app.osaas.io/browse/eyevinn-player-analytics-eventsink)

Eyevinn Open Analytics is an open source solution for tracking events from video players. Based on the open standard Eyevinn Player Analytics ([EPAS](https://github.com/Eyevinn/player-analytics-specification/tree/main)) it enables a modular framework where you are not locked in with a specific vendor. This is the eventsink module that receives and validate the data from the players and push the data on to a processing quque.

## Hosted Solution

Available as an open web service in [Eyevinn Open Source Cloud](https://www.osaas.io). Read this [documentation to quickly get started](https://docs.osaas.io/osaas.wiki/Service%3A-Player-Analytics-Eventsink.html) with the hosted solution.

## Development

The simplest way to run an eventsink locally is to use the fastify service, by running `npm start`. This will spin up a local server at port 3000 which you can use as eventsink url in your [Eyevinn Player Analytics Client SDK](https://github.com/Eyevinn/player-analytics-client-sdk-web) project. You may as well specify your environment variables as the standard specifies.

e.g. `QUEUE_TYPE=redis npm start` will start a `fastify` service towards your local `redis` as queue.

## Environment Variables

```bash
QUEUE_TYPE = "<SQS | beanstalkd | redis>"
HEARTBEAT_INTERVAL = "<heartbeat-interval>"
CORS_ALLOWED_ORIGINS = "<comma-separated-list-of-origins-to-allow>"

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
```

## Memory Queue

The eventsink includes a **memory queue feature enabled by default** that provides immediate responses to clients while processing events in the background. This reduces load on the primary queue system and improves response times.

For detailed configuration options and usage information, see [Memory Queue Documentation](MEMORY_QUEUE.md).

# About Eyevinn Technology

Eyevinn Technology is an independent consultant firm specialized in video and streaming. Independent in a way that we are not commercially tied to any platform or technology vendor.

At Eyevinn, every software developer consultant has a dedicated budget reserved for open source development and contribution to the open source community. This give us room for innovation, team building and personal competence development. And also gives us as a company a way to contribute back to the open source community.

Want to know more about Eyevinn and how it is to work here. Contact us at work@eyevinn.se!
