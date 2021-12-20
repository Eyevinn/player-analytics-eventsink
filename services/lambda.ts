import { Validator } from '../lib/Validator';
import { ALBResult, ALBEvent } from 'aws-lambda';
import Sender from '../lib/Sender';
import Logger from '../logging/logger';

export const handler = async (event: ALBEvent): Promise<ALBResult> => {
  const validator = new Validator(Logger);
  let response: ALBResult = {
    statusCode: 200,
    statusDescription: 'OK',
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Origin',
    },
    body: '{}',
  };

  if (event.httpMethod === 'POST' && event.path === '/' && event.body) {
    let requestHost: string = 'unknown';
    if (event.headers && event.headers['host']) {
      requestHost = event.headers['host'];
    }
    const body = JSON.parse(event.body);
    const validEvent = validator.validateEvent(body);
    if (validEvent) {
      response.statusCode = 200;
      response.statusDescription = 'OK';
      let sender = new Sender(Logger);
      body['host'] = requestHost;
      const resp = await sender.send(body);
      response.body = JSON.stringify({
        validEvent: validEvent,
        SQS: resp,
      });
    } else {
      response.statusCode = 400;
      response.statusDescription = 'Bad Request';
      response.body = JSON.stringify({
        message: 'Invalid player event',
        validEvent: validEvent,
      });
    }
  }
  return response;
};
