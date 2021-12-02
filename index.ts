import { Validator } from './lib/JSONValidator';
import { SQSSender } from './lib/SQSSender';
import Logger from './logging/logger';

export const handler = async (event, context): Promise<any> => {
  const validator = new Validator(Logger);
  const request = event.Records[0].cf.request;
  const body = request.body;
  const response = {
    status: '200',
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
    body: '',
  };

  if (request.method === 'POST' && request.uri === '/') {
    Logger.debug('Received POST request' + JSON.stringify(request));
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
      response.status = '200';
      response.statusDescription = 'OK';
      response.body = resp;
    } else {
      response.status = '400';
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

async function validate(event: any): Promise<any> {}
