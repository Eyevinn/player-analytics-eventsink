import { Validator } from '../lib/Validator';
import { generatedInitResponseBody, generateInvalidResponseBody, generateValidResponseBody, responseHeaders } from "../lib/route-helpers";
import Sender from '../lib/sender';
import Logger from '../logging/logger';
import { initResponseBody, responseBody } from '../types/interfaces';

const fastify = require('fastify')()
const validator = new Validator(Logger);

fastify.post('/', async (request, reply) => {
  const body = request.body instanceof Object
    ? request.body
    : JSON.parse(request.body);
  const validEvent = validator.validateEvent(body);
  if (validEvent) {
    const responseBody: initResponseBody | responseBody =
      body.event === 'init'
        ? generatedInitResponseBody(body)
        : generateValidResponseBody(body);
    let sender = new Sender(Logger);
    const resp = await sender.send(body);
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
})

const start = async () => {
  try {
    await fastify.listen(3000);
  } catch (err) {
    Logger.error("Error starting server", err);
    process.exit(1);
  }
}
start();
