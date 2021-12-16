import { Validator } from '../lib/jsonvalidator';
import { ALBResult, ALBEvent } from 'aws-lambda';
import Sender from '../lib/sender';
import Logger from '../logging/logger';

export const handler = async (event: ALBEvent): Promise<ALBResult> => {
  const validator = new Validator(Logger);
  let response: ALBResult = {
    statusCode: 200,
    statusDescription: 'OK',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  };

  if (event.httpMethod === 'POST' && event.path === '/' && event.body) {
    const body = JSON.parse(event.body);
    let validEvent: boolean;
    validEvent = validator.validateEvent(body);
    if (validEvent) {
      response.statusCode = 200;
      response.statusDescription = 'OK';
      let sender = new Sender(Logger);
      const resp = await sender.send(body);
      response.body = JSON.stringify({
        validEvent: validEvent,
        SQS: resp
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
