import { Validator } from './lib/JSONValidator';
import Sender from './lib/Sender';
import Logger from './logging/logger';

export const handler = async (event): Promise<any> => {
  const validator = new Validator(Logger);
  let response = {
    statusCode: 200,
    statusDescription: 'OK',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  };

  if (event.httpMethod === 'POST' && event.path === '/') {
    const body = JSON.parse(event.body);
    let validEvent: any;
    validEvent = validator.validateEvent(body);
    if (validEvent) {
      response.statusCode = 200;
      response.statusDescription = 'OK';
      let sender = new Sender(Logger);
      const resp = await sender.send(validEvent);
      response.body = JSON.stringify(resp);
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
