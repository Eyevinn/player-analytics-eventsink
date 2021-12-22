import winston from 'winston';

export type validatorResponse = {
  statusCode: number,
  statusDescription: string,
  headers: Object,
  body: Object,
}

export interface EventValidator {
  logger: winston.Logger;
  eventSchema: any;
  validateEvent(event: Object): Object;
  validResponse(event?: Object): Object;
  invalidResponse(event?: Object): Object;
}
