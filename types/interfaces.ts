import winston from 'winston';

export interface EventValidator {
  logger: winston.Logger;
  eventSchema: any;
  validateEvent(event: Object): any;
  validateEventList(eventList: Array<Object>): any;
}

export abstract class EventSender {
  logger: winston.Logger;
  abstract send(event: any, isArray: boolean): Promise<{}>;
}

export abstract class QueueEvent {
  logger: winston.Logger;
  Client: any;
  abstract pushToQueue(body: Object): Promise<{}>;
}
