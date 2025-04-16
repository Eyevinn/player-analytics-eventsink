# Eyevinn Player Analytics (EPAS) Eventsink

[![Badge OSC](https://img.shields.io/badge/Evaluate-24243B?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8yODIxXzMxNjcyKSIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI3IiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiLz4KPGRlZnM%2BCjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQwX2xpbmVhcl8yODIxXzMxNjcyIiB4MT0iMTIiIHkxPSIwIiB4Mj0iMTIiIHkyPSIyNCIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjQzE4M0ZGIi8%2BCjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzREQzlGRiIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM%2BCjwvc3ZnPgo%3D)](https://app.osaas.io/browse/eyevinn-player-analytics-eventsink)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Slack](http://slack.streamingtech.se/badge.svg)](http://slack.streamingtech.se)

The Eyevinn Player Analytics (EPAS) is an open sourced framework and specification for tracking events from video players. It is a modular framework where you can pick and choose the modules you need. This is the eventsink module that receives the data from the players and push the data on to a processing queue.

## AWS

To run the eventsink in AWS as a Lambda function and SQS as processing queue:

```
// your index.js
const { Lambda } = require("@eyevinn/player-analytics-eventsink");

export const handler = Lambda.handler;
```

To use with SQS add the following environment variables to the Lambda configuration.

```
QUEUE_TYPE=SQS
SQS_QUEUE_URL=<sqs-url>
```

## Development

The simplest way to run an eventsink locally is to use the fastify service, by running `npm run dev`. This will spin up a local server at port 3000 which you can use as eventsink url in your [Eyevinn Player Analytics Client SDK](https://github.com/Eyevinn/player-analytics-client-sdk-web) project. You may as well specify your environment variables as the standard specifies.

e.g. `QUEUE_TYPE=redis npm run dev` will start a `fastify` service towards your local `redis` as queue.

## Environment Variables

```bash
QUEUE_TYPE = <SQS | beanstalkd | redis>
HEARTBEAT_INTERVAL = <heartbeat-interval>

# AWS (Lambda & SQS) specifics
AWS_REGION = <your-aws-region>
# SQS specifics
SQS_QUEUE_URL = <your-sqs-queue-url>

# Redis specifics
REDIS_HOST = <default localhost>
REDIS_PORT = <default 6379>
REDIS_PASSWORD = <default empty>
```

# About Eyevinn Technology

Eyevinn Technology is an independent consultant firm specialized in video and streaming. Independent in a way that we are not commercially tied to any platform or technology vendor.

At Eyevinn, every software developer consultant has a dedicated budget reserved for open source development and contribution to the open source community. This give us room for innovation, team building and personal competence development. And also gives us as a company a way to contribute back to the open source community.

Want to know more about Eyevinn and how it is to work here. Contact us at work@eyevinn.se!
