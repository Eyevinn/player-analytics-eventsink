import { Validator } from '../lib/Validator';
import { ALBResult, ALBEvent } from 'aws-lambda';
import Sender from '../lib/Sender';
import Logger from '../logging/logger';
import { generateInvalidResponseBody, responseHeaders } from '../lib/route-helpers';

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
      response.body = JSON.stringify({
        ...body,
        QueueResp: resp
      });
    } else {
      response.body = JSON.stringify(generateInvalidResponseBody(body));
    }
    return response as ALBResult;
  }
  const response = {
    statusCode: 400,
    statusDescription: 'Bad Request',
    headers: responseHeaders,
    body: JSON.stringify(generateInvalidResponseBody()),
  }
  return response as ALBResult;
};
