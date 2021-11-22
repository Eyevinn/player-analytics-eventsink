import { Validator } from './Validator/JSONValidator';
import Logger from "./logging/logger";
const querystring = require('querystring');

exports.handler = (event, context, callback) => {
  const validator = new Validator(Logger);
  const request = event.Records[0].cf.request;
  let response = {
    status: '200',
    statusDescription: 'OK',
    headers: {
      'cache-control': [{
        key: 'Cache-Control',
        value: 'max-age=1000'
      }],
      'content-type': [{
        key: 'Content-Type',
        value: 'text/html'
      }]
    },
    body: "",
  };

  if (request.method === 'POST') {
    const body = Buffer.from(request.body.data, 'base64').toString();
    const playerEvent = querystring.parse(body);
    let validEvent: any;
    if (Array.isArray(playerEvent)) {
      validEvent = validator.validateEventList(playerEvent);
    } else {
      validEvent = validator.validateEvent(playerEvent);
    }
    if (validEvent) {
      response.status = '200';
      response.statusDescription = 'OK';
    } else {
      response.status = '400';
      response.statusDescription = 'Bad Request';
      response.body = JSON.stringify(validEvent.errors);
    }
  }
  callback(null, response);
};