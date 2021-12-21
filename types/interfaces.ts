import winston from 'winston';

export interface EventValidator {
  logger: winston.Logger;
  eventSchema: any;
  validateEvent(event: Object): Object;
  validResponse(event?: Object): Object;
  invalidResponse(event?: Object): Object;
}
