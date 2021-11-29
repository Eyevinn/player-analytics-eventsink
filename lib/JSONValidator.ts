import { EventValidator } from '../types/interfaces';
import * as fs from 'fs';
import * as path from 'path';
import winston from 'winston';
import Ajv from 'ajv';

export class Validator implements EventValidator {
  logger: winston.Logger;
  eventSchema: any;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.eventSchema = this.loadSchema();
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
    if (!valid) {
      this.logger.warn(`Event: \n ${JSON.stringify(event, null, 4)} is invalid`);
      return valid;
    }
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

  loadSchema(filePath?: string): Object {
    const schemaPath = filePath ? filePath : `../resources/schema.json`;
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, schemaPath), 'utf-8'));
  }
}
