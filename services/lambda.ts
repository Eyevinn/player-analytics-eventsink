import { Validator } from '../lib/Validator';
import { ALBResult, ALBEvent } from 'aws-lambda';
import Sender from '../lib/Sender';
import Logger from '../logging/logger';
import {
  generateInitResponseBody,
  generateInvalidResponseBody,
  generateResponseStatus,
  generateValidResponseBody,
  generateResponseHeaders,
} from '../lib/route-helpers';
import { initResponseBody, responseBody } from '../types/interfaces';

export const handler = async (event: ALBEvent): Promise<ALBResult> => {
  const validator = new Validator(Logger);

  let origin: string = 'unknown';
  if (event.headers && event.headers['origin']) {
    origin = event.headers['origin'];
  }
  const responseHeaders = generateResponseHeaders(origin);
  
  if (event.httpMethod === 'POST' && event.path === '/' && event['body']) {
    let requestHost: string = 'unknown';
    if (event.headers && event.headers['host']) {
      requestHost = event.headers['host'];
    }
    const body = JSON.parse(event.body);
    const validatorTs = Date.now();
    const validEvent = validator.validateEvent(body);
    Logger.debug(`Time taken to validate event-> ${Date.now() - validatorTs}ms`);
    const response = {
      statusCode: validEvent ? 200 : 400,
      statusDescription: validEvent ? 'OK' : 'Bad Request',
      headers: responseHeaders,
      body: '{}',
    };
    if (validEvent) {
      const sender = new Sender(Logger);
      body.host = requestHost;
      const senderTs = Date.now();
      const resp = await sender.send(body);
      Logger.debug(`Time taken to send event to Queue-> ${Date.now() - senderTs}ms`);
      const responseBody: initResponseBody | responseBody =
        body.event === 'init' ? generateInitResponseBody(body) : generateValidResponseBody(body, resp);
      response.body = JSON.stringify(responseBody);
    } else {
      response.body = JSON.stringify(generateInvalidResponseBody(body));
    }
    return response as ALBResult;
  }
  if (event.httpMethod === 'OPTIONS' && event.path === '/') {
    const response = {
      statusCode: 200,
      statusDescription: 'OK',
      headers: responseHeaders,
      body: '{ status: "OK" }',
    };
    return response as ALBResult;
  }
  // If wrong path, respond with 404. If unsupported method, respond with method not allowed. Otherwise bad access.
  const { statusCode, statusDescription } = generateResponseStatus({
    path: event.path,
    method: event.httpMethod,
  });
  const response = {
    statusCode,
    statusDescription,
    headers: responseHeaders,
    body: JSON.stringify(generateInvalidResponseBody()),
  };
  return response as ALBResult;
};
