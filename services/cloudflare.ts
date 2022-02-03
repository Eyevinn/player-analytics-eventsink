import { Router } from "cloudflare-router";
import { Validator } from '../lib/Validator';
import Sender from '../lib/Sender';
import Logger from '../logging/logger';
import { generateInvalidResponseBody, generateResponseStatus, generateValidResponseBody, responseHeaders } from '../lib/route-helpers';

const router = new Router();

router.post("/", async (_request, response) => {
    const validator = new Validator(Logger);
  if (_request.path === '/' && _request.body) {
    let requestHost: string = 'unknown';
    if (_request.headers && _request.headers['host']) {
      requestHost = _request.headers['host'];
    }
    const body = JSON.parse(JSON.stringify(_request.body));
    const validEvent = validator.validateEvent(body);
    const response = {
      statusCode: validEvent ? 200 : 400,
      statusDescription: validEvent ? 'OK' : 'Bad Request',
      headers: responseHeaders,
      body: '{}',
    }
    if (validEvent) {
      const sender = new Sender(Logger);
      body.host = requestHost;
      const resp = await sender.send(body);
      response.body = JSON.stringify(generateValidResponseBody(body, resp));
    } else {
      response.body = JSON.stringify(generateInvalidResponseBody(body));
    }
    return response;
    }
});
router.options("/", async (_request, response) => {
    response.statusCode(200);
    response.status("OK");
    response.header(responseHeaders);
    response.text('status: "OK"');
    
    return response;
  });
  router.route({
    method: ['GET', 'POST', 'OPTIONS', 'PATCH', 'PUT', 'DELETE'],
    url: '/*',
    handler: (request, reply) => {
      const { statusCode, statusDescription } = generateResponseStatus({ path: request.url, method: request.method });
      reply.status(statusCode).headers(responseHeaders).send(statusDescription);
    }
  });

addEventListener("fetch", event => {
  event.respondWith(
    router.serve(event.request)
      .then(returned => returned.response)
  );
});
