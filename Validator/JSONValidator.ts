import { EventValidator } from '../interfaces';
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
    const validator = new Ajv();
    const validate = validator.compile(this.eventSchema);
    const valid = validate(event);
    this.logger.debug(`Event ${JSON.stringify(event)} is ${valid ? 'valid' : 'NOT valid'}`);
    return valid;
  }

  /**
   * Method that validates a list of event objects
   * @param eventList the list with event objects
   */
  validateEventList(eventList: Array<Object>): any {
    for (const event of eventList) {
      if (!this.validateEvent(event)) return false;
    }
    return true;
  }

  loadSchema(): Object {
    const filePath = `../resources/schema.json`;
    const encodeData = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, filePath), 'utf-8')
    );
    return encodeData;
  }
}
