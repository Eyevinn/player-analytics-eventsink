import { Validator } from './lib/JSONValidator';
import { SQSSender } from './lib/SQSSender';
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
    Logger.debug('Received POST request' + JSON.stringify(event));
    const body = JSON.parse(event.body);
    let validEvent: any;
    let isArray = false;
    if (Array.isArray(body)) {
      isArray = true;
      validEvent = validator.validateEventList(body);
    } else {
      validEvent = validator.validateEvent(body);
    }
    if (validEvent) {
      const sqsSender = new SQSSender(Logger);
      const resp = JSON.stringify(await sqsSender.pushToQueue(body, isArray));
      Logger.info(`${resp}`);
      response.statusCode = 200;
      response.statusDescription = 'OK';
      response.body = resp;
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
