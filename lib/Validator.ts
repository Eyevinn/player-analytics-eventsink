import { EventValidator } from '../types/interfaces';
import { schema } from '../resources/schema';
import winston from 'winston';
import Ajv from 'ajv';

export class Validator implements EventValidator {
  logger: winston.Logger;
  eventSchema: object;

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

    const ajv = new Ajv({ allowUnionTypes: true });
    ajv.addSchema(this.eventSchema);
    const validator = ajv.getSchema('#/definitions/TPlayerAnalyticsEvent');
    if (validator) {
      const valid = validator(event);
      this.logger.debug(`Event: \n ${JSON.stringify(event)} is ${valid ? 'valid' : 'invalid'}`);
      if (!valid) {
        this.logger.debug(validator.errors);
      }
      return valid as boolean;
    } else {
      this.logger.error('AJV failed in generating a validator for specified JSON schema');
      return false;
    }
  }
}
