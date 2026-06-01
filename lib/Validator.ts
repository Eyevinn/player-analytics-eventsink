import { EventValidator, ValidationResult } from '../types/interfaces';
import { schema } from '../resources/schema';
import winston from 'winston';
import Ajv, { ValidateFunction } from 'ajv';

export class Validator implements EventValidator {
  logger: winston.Logger;
  eventSchema: object;
  private compiledValidator: ValidateFunction | null;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.eventSchema = schema;

    // Compile schema ONCE at construction time
    const ajv = new Ajv({ allowUnionTypes: true });
    ajv.addSchema(this.eventSchema);
    this.compiledValidator = ajv.getSchema('#/definitions/TPlayerAnalyticsEvent') || null;

    if (!this.compiledValidator) {
      this.logger.error('AJV failed in generating a validator for specified JSON schema');
    }
  }

  /**
   * Method that validates a single event object
   * @param event the event object
   * @returns ValidationResult with valid flag and optional error details
   */
  validateEvent(event: Object | undefined | null): ValidationResult {
    if (!event) {
      this.logger.error('Event is undefined');
      return {
        valid: false,
        errors: [{ field: '', message: 'Event is undefined' }],
      };
    }

    if (!this.compiledValidator) {
      this.logger.error('No compiled validator available');
      return {
        valid: false,
        errors: [{ field: '', message: 'Schema validator not available' }],
      };
    }

    const valid = this.compiledValidator(event);
    this.logger.debug(`Event: \n ${JSON.stringify(event)} is ${valid ? 'valid' : 'invalid'}`);

    if (!valid && this.compiledValidator.errors) {
      this.logger.debug(this.compiledValidator.errors);
      // Deduplicate errors (anyOf schemas produce duplicates per variant)
      const seen = new Set<string>();
      const errors = this.compiledValidator.errors
        .map((err) => ({
          field: err.instancePath || '/',
          message: err.message || 'Unknown validation error',
        }))
        .filter((err) => {
          const key = `${err.field}:${err.message}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      return { valid: false, errors };
    }

    return { valid: valid as boolean };
  }
}
