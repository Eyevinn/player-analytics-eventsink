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
  validateEvent(event: Object): boolean {
    if (!event) {
      this.logger.error('Event is undefined');
      return false;
    }
    const validator = new Ajv();
    const validate = validator.compile(this.eventSchema);
    const valid = validate({ event });
    this.logger.info(`Event: \n ${JSON.stringify(event)} is ${valid ? 'valid' : 'invalid'}`);
    if (!valid) {
      this.logger.debug(validate.errors);
    }
    return valid;
  }
}
