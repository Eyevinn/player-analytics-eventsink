import { Validator } from './lib/JSONValidator';
import { SQSSender } from './lib/SQSSender';
import Logger from './logging/logger';

export const handler = async (event: any) => {
  const validator = new Validator(Logger);
  let response = {
    statusCode: 200,
    statusDescription: 'OK',
    headers: {
      'cache-control': [
        {
          key: 'Cache-Control',
          value: 'max-age=1000',
        },
      ],
      'content-type': [
        {
          key: 'Content-Type',
          value: 'text/html',
        },
      ],
    },
    body: {},
  };

  if (event.httpMethod === 'POST') {
    let validEvent: any;
    let isArray = false;
    if (Array.isArray(JSON.parse(event.body))) {
      isArray = true;
      validEvent = validator.validateEventList(JSON.parse(event.body));
    } else {
      validEvent = validator.validateEvent(JSON.parse(event.body));
    }
    if (!validEvent) {
      response.statusCode = 400;
      response.statusDescription = 'Bad Request';
    } else {
      const sqsSender = new SQSSender(Logger);
      const resp = await sqsSender.pushToQueue(event.body, isArray);
      response.body = JSON.stringify(resp);
    }
    return response;
  }
  return response;
};
