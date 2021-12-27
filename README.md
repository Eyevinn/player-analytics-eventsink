# player-analytics-eventsink

## Setup

To be able to build and run the project a `.npmrc` file is needed with the following content:

``` txt
@eyevinn:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<token>
```

Where `<token>` is your personal GitHub access token, for more information see [link](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-with-a-personal-access-token).

## Development

The simplest way to run an eventsink locally is to use the fastify service, by running `npm run dev`. This will spin up a local server at port 3000 which you can use as eventsink url in your [Eyevinn Player Analytics Client SDK](https://github.com/Eyevinn/player-analytics-client-sdk-web) project.

## Environment Variables

```
AWS_REGION = <your-aws-region>
SQS_QUEUE_URL = <your-sqs-queue-url>
QUEUE_TYPE = <SQS | beanstalkd>
HEARTBEAT_INTERVAL = <heartbeat-interval>
```
