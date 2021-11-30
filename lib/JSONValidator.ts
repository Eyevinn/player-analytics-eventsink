import { EventValidator } from '../types/interfaces';
import { schema } from '../resources/schema';
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
  validateEvent(event: Object): any {
    if (!event) {
      this.logger.error('Event is undefined');
      return false;
    }
    const validator = new Ajv();
    const validate = validator.compile(this.eventSchema);
    const valid = validate({ event });
    this.logger.debug(`Event: \n ${JSON.stringify(event, null, 4)} is ${valid ? "valid" : `invalid`}`);
    return valid;
  }

  /**
   * Method that validates a list of event objects
   * @param eventList the list with event objects
   */
  validateEventList(eventList: Array<Object>): any {
    if (!eventList) {
      this.logger.error('Event list is undefined');
      return false;
    }
    for (const event of eventList) {
      if (!this.validateEvent(event)) return false;
    }
    return true;
  }
}
