# Eyevinn Player Analytics (EPAS) Eventsink

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
CORS_ORIGIN = <comma separated list of allowed origins default is to allow all>

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