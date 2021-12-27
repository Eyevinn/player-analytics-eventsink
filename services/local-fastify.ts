import { Validator } from '../lib/Validator';
import { generatedInitResponseBody, generateInvalidResponseBody, generateResponseStatus, generateValidResponseBody, responseHeaders } from "../lib/route-helpers";
import Sender from '../lib/sender';
import Logger from '../logging/logger';
import { initResponseBody, responseBody } from '../types/interfaces';

const fastify = require('fastify')()
const validator = new Validator(Logger);

fastify.options('/', (request, reply) => {
  reply
    .status(200)
    .headers(responseHeaders)
    .send({ status: "ok" });
});

fastify.post('/', async (request, reply) => {
  const body = request.body instanceof Object
    ? request.body
    : JSON.parse(request.body);
  const validEvent = validator.validateEvent(body);
  if (validEvent) {
    let sender = new Sender(Logger);
    const resp = await sender.send(body);
    const responseBody: initResponseBody | responseBody =
      body.event === 'init'
        ? generatedInitResponseBody(body)
        : generateValidResponseBody(body, resp);
    console.log(responseBody);
    reply
      .status(200)
      .headers(responseHeaders)
      .send(responseBody);
  } else {
    reply
      .status(400)
      .headers(responseHeaders)
      .send(generateInvalidResponseBody(body));
  }
});

fastify.route({
  method: ['GET', 'POST', 'OPTIONS', 'PATCH', 'PUT', 'DELETE'],
  url: '/*',
  handler: (request, reply) => {
    const { statusCode, statusDescription } = generateResponseStatus({ path: request.url, method: request.method });
    reply.status(statusCode).headers(responseHeaders).send(statusDescription);
  },
});

const start = async () => {
  try {
    await fastify.listen(3000);
  } catch (err) {
    Logger.error("Error starting server", err);
    process.exit(1);
  }
}
start();
