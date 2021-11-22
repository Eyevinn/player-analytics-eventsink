import winston from "winston";

export interface EventValidator {
  logger: winston.Logger;
  eventSchema: any;
  validateEvent(event: Object): any;
  validateEventList(eventList: Array<Object>): any;
}
