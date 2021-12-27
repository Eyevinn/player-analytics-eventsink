# player-analytics-eventsink

## Setup

To be able to build and run the project a `.npmrc` file is needed with the following content:

``` txt
@eyevinn:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<token>
```

Where `<token>` is your personal GitHub access token, for more information see [link](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-with-a-personal-access-token).

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
