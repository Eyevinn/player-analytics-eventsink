import { Validator } from '../lib/JSONValidator';
import { ALBResult, ALBEvent } from 'aws-lambda';
import Sender from '../lib/Sender';
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
    let validEvent: any;
    validEvent = validator.validateEvent(body);
    if (validEvent) {
      response.statusCode = 200;
      response.statusDescription = 'OK';
      let sender = new Sender(Logger);
      const resp = await sender.send(validEvent);
      response.body = JSON.stringify({
        validEvent: true,
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
    return response;
  }
  return response;
};