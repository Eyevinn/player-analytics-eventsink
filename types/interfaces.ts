import winston from 'winston';

export interface EventValidator {
  logger: winston.Logger;
  eventSchema: any;
  validateEvent(event: Object): any;
  validateEventList(eventList: Array<Object>): any;
}

export interface EventSender {
  logger: winston.Logger;
  send(event: Object): Promise<Object>;
}

export abstract class AbstractQueueAdapter {
  logger: winston.Logger;
  client: any;
  abstract pushToQueue(body: Object): Promise<Object>;
}
