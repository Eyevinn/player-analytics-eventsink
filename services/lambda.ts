import { Validator } from '../lib/Validator';
import { ALBResult, ALBEvent } from 'aws-lambda';
import Sender from '../lib/Sender';
import Logger from '../logging/logger';

export const handler = async (event: ALBEvent): Promise<ALBResult> => {
  const validator = new Validator(Logger);
  if (event.httpMethod === 'POST' && event.path === '/' && event.body) {
    let requestHost: string = 'unknown';
    if (event.headers && event.headers['host']) {
      requestHost = event.headers['host'];
    }
    const body = JSON.parse(event.body);
    const validatorResp = validator.validateEvent(body);
    if (validatorResp['body']['valid']) {
      const sender = new Sender(Logger);
      body['host'] = requestHost;
      const resp = await sender.send(body);
      validatorResp['body'].QueueResp = resp;
    }
    validatorResp['body'] = JSON.stringify(validatorResp['body']);
    return validatorResp as ALBResult;
  } else {
    return validator.validResponse() as ALBResult;
  }
};
