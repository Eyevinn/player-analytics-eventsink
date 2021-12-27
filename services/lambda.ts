import { Validator } from '../lib/Validator';
import { ALBResult, ALBEvent } from 'aws-lambda';
import Sender from '../lib/Sender';
import Logger from '../logging/logger';
import { generateInvalidResponseBody, generateResponseStatus, generateValidResponseBody, responseHeaders } from '../lib/route-helpers';

export const handler = async (event: ALBEvent): Promise<ALBResult> => {
  const validator = new Validator(Logger);
  if (event.httpMethod === 'POST' && event.path === '/' && event['body']) {
    let requestHost: string = 'unknown';
    if (event.headers && event.headers['host']) {
      requestHost = event.headers['host'];
    }
    const body = JSON.parse(event.body);
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
    return response as ALBResult;
  }
  // If wrong path, respond with 404. If unsupported method, respond with method not allowd. Otherwise bad access.
  const { statusCode, statusDescription } = generateResponseStatus({ path: event.path, method: event.httpMethod });
  const response = {
    statusCode,
    statusDescription,
    headers: responseHeaders,
    body: JSON.stringify(generateInvalidResponseBody()),
  }
  return response as ALBResult;
};
