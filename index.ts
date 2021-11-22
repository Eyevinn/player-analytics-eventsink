import { Validator } from './Validator/JSONValidator';
import Logger from './logging/logger';
import querystring from 'querystring';

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
    if (Array.isArray(JSON.parse(event.body))) {
      validEvent = validator.validateEventList(JSON.parse(event.body));
    } else {
      validEvent = validator.validateEvent(JSON.parse(event.body));
    }
    if (!validEvent) {
      response.statusCode = 400;
      response.statusDescription = 'Bad Request';
    } else {
      response.body = event.body;
    }
    return response;
  }
  response.statusCode = 400;
  response.statusDescription = 'Bad Request';
  return response;
};
