import { EventValidator } from '../types/interfaces';
import { schema } from '../resources/schema';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import Ajv from 'ajv';

export class Validator implements EventValidator {
  logger: winston.Logger;
  eventSchema: any;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.eventSchema = schema;
  }

  /**
   * Method that validates a single event object
   * @param event the event object
   */
  validateEvent(event: Object): Object {
    if (!event) {
      this.logger.error('Event is undefined');
      return {};
    }
    if (event['event'] === 'init') {
      event = this.createEventResponse(event);
    }
    const validator = new Ajv();
    const validate = validator.compile(this.eventSchema);
    const valid = validate({ event });
    this.logger.info(
      `Event: \n ${JSON.stringify(event)} is ${valid ? 'valid' : 'invalid'}`
    );
    if (valid) {
      return this.validResponse(event);
    } else {
      return this.invalidResponse(event);
    }
  }

  private createEventResponse(event: Object): Object {
    if (!event['sessionId']) {
      event['sessionId'] = uuidv4();
    }
    event['heartbeatInterval'] = process.env.HEARTBEAT_INTERVAL || 5000;
    return event;
  }

  /**
   * Method that returns a valid response
   * @param optional event object
   */
  validResponse(event?: Object): Object {
    let body: Object;
    let response = {
      statusCode: 200,
      statusDescription: 'OK',
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Origin',
      },
      body: {},
    };
    if (!event) {
      response.body = '{}';
      return response;
    }
    body = {
      sessionId: event['sessionId'],
      valid: true,
    };
    if (event['event'] === 'init') {
      body['heartbeatInterval'] = event['heartbeatInterval'];
    }
    response.body = body;
    return response;
  }

  /**
   * Method that returns an invalid response
   * @param optional event object
   */
  invalidResponse(event?: Object): Object {
    let response = {
      statusCode: 400,
      statusDescription: 'Bad Request',
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Origin',
      },
      body: {},
    };
    if (!event) {
      response.body = '{}';
      return response;
    }
    response.body = {
      sessionId: event['sessionId'],
      Message: 'Invalid player event',
      valid: false,
    };
    return response;
  }
}
