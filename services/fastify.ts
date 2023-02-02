import { Validator } from '../lib/Validator';
import { 
  generateInitResponseBody, 
  generateInvalidResponseBody, 
  generateResponseStatus, 
  generateValidResponseBody, 
  generateResponseHeaders 
} from "../lib/route-helpers";
import Sender from '../lib/Sender';
import Logger from '../logging/logger';
import { initResponseBody, responseBody } from '../types/interfaces';

export const fastify = require('fastify')()
const validator = new Validator(Logger);

fastify.options('/', (request, reply) => {
  const responseHeaders = generateResponseHeaders(request.headers['origin']);
  reply
    .status(200)
    .headers(responseHeaders)
    .send({ status: "ok" });
});

fastify.post('/', async (request, reply) => {
  const body = request.body instanceof Object
    ? request.body
    : JSON.parse(request.body);
  const responseHeaders = generateResponseHeaders(request.headers['Origin']);
  const validatorTs = Date.now();
  const validEvent = validator.validateEvent(body);
  Logger.debug(`Time taken to validate event-> ${Date.now() - validatorTs}ms`);
  if (validEvent) {
    let sender = new Sender(Logger);
    const senderTs = Date.now();
    const resp = await sender.send(body);
    Logger.debug(`Time taken to send event to Queue-> ${Date.now() - senderTs}ms`);
    const responseBody: initResponseBody | responseBody =
    body.event === 'init'
    ? generateInitResponseBody(body)
    : generateValidResponseBody(body, resp);
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
    const responseHeaders = generateResponseHeaders(request.headers['Origin']);
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
