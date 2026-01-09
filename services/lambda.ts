import { Validator } from '../lib/Validator';
import { ALBResult, ALBEvent } from 'aws-lambda';
import Sender from '../lib/Sender';
import Logger from '../logging/logger';
import {
  generateInitResponseBody,
  generateInvalidResponseBody,
  generateResponseHeaders,
  generateResponseStatus,
  generateValidResponseBody,
  withTimeout,
  getTimeoutMs,
} from '../lib/route-helpers';
import { initResponseBody, responseBody } from '../types/interfaces';

const validator = new Validator(Logger);
const sender = new Sender(Logger);

export const handler = async (event: ALBEvent): Promise<ALBResult> => {
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
      headers: generateResponseHeaders(),
      body: '{}',
    };
    if (validEvent) {
      body.host = requestHost;
      const senderTs = Date.now();
      try {
        const useMemoryQueue = process.env.DISABLE_MEMORY_QUEUE !== 'true';
        
        if (useMemoryQueue) {
          const resp = await sender.send(body);
          Logger.debug(`Time taken to queue event in memory-> ${Date.now() - senderTs}ms`);
          const responseBody: initResponseBody | responseBody =
            body.event === 'init' ? generateInitResponseBody(body) : generateValidResponseBody(body, resp);
          response.body = JSON.stringify(responseBody);
        } else {
          const resp = await withTimeout(sender.send(body), getTimeoutMs());
          Logger.debug(`Time taken to send event to Queue-> ${Date.now() - senderTs}ms`);
          const responseBody: initResponseBody | responseBody =
            body.event === 'init' ? generateInitResponseBody(body) : generateValidResponseBody(body, resp);
          response.body = JSON.stringify(responseBody);
        }
      } catch (error) {
        Logger.error('Sender timeout or error:', error);
        response.statusCode = 502;
        response.statusDescription = 'Bad Gateway';
        response.body = JSON.stringify({
          sessionId: body.sessionId || -1,
          message: error.message === 'Operation timed out' ? 'Request timeout' : 'Queue service unavailable',
          valid: false,
        });
      }
    } else {
      response.body = JSON.stringify(generateInvalidResponseBody(body));
    }
    return response as ALBResult;
  }
  if (event.httpMethod === 'OPTIONS' && event.path === '/') {
    const response = {
      statusCode: 200,
      statusDescription: 'OK',
      headers: generateResponseHeaders(),
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
    headers: generateResponseHeaders(),
    body: JSON.stringify(generateInvalidResponseBody()),
  };
  return response as ALBResult;
};
