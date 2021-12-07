import winston from 'winston';

export interface EventValidator {
  logger: winston.Logger;
  eventSchema: any;
  validateEvent(event: Object): any;
  validateEventList(eventList: Array<Object>): any;
}

export abstract class AbstractQueueAdapter {
  logger: winston.Logger;
  client: any;
  abstract pushToQueue(body: Object): Promise<Object>;
}
