import { EventValidator, ValidationError, ValidationResult } from '../types/interfaces';
import { schema } from '../resources/schema';
import winston from 'winston';
import Ajv, { ErrorObject, ValidateFunction } from 'ajv';

const EPAS_EVENT_POINTER = '#/definitions/TPlayerAnalyticsEvent';

export class Validator implements EventValidator {
  logger: winston.Logger;
  eventSchema: object;
  private compiledValidator: ValidateFunction;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.eventSchema = schema;

    // AJV compile is O(schema-size) and dominates per-request time;
    // hoisting to the constructor turns validation into a cache hit.
    // `allErrors: true` lets us surface every offender (multiple missing
    // fields, multiple unexpected keys) rather than stopping at the first.
    const ajv = new Ajv({ allowUnionTypes: true, allErrors: true });
    ajv.addSchema(this.eventSchema);
    const compiled = ajv.getSchema(EPAS_EVENT_POINTER);

    if (!compiled) {
      // Fail-fast: a broken schema pointer would otherwise cause every
      // request to return 400 forever with no useful diagnostics.
      const ajvErrors = ajv.errors ? JSON.stringify(ajv.errors) : 'none';
      const message =
        `AJV failed to resolve validator at pointer ${EPAS_EVENT_POINTER}. ` +
        `Check @eyevinn/player-analytics-specification schema. AJV errors: ${ajvErrors}`;
      this.logger.error(message);
      throw new Error(message);
    }
    this.compiledValidator = compiled;
  }

  /**
   * Validate a single event object against the EPAS schema.
   *
   * @param event the event payload to validate. `undefined`/`null` produces
   *   a synthetic validation error rather than throwing.
   * @returns a discriminated `ValidationResult`. On `valid: false` the
   *   `errors` array is guaranteed non-empty; each `field` is an AJV
   *   `instancePath` (JSON Pointer, e.g. `/sessionId`) or `/` for the root.
   */
  validateEvent(event: Object | undefined | null): ValidationResult {
    if (!event) {
      this.logger.error('Event is undefined');
      return {
        valid: false,
        errors: [{ field: '', message: 'Event is undefined' }],
      };
    }

    const valid = this.compiledValidator(event);
    this.logger.debug(`Event: \n ${JSON.stringify(event)} is ${valid ? 'valid' : 'invalid'}`);

    if (valid) {
      return { valid: true };
    }

    const errors = this.mapAjvErrors(this.compiledValidator.errors);
    if (errors.length === 0) {
      // Defensive: AJV returned false but no error details (rare — $async
      // schemas or unusual keywords). Surface something rather than an
      // empty 400 body.
      return {
        valid: false,
        errors: [{ field: '', message: 'Validation failed with no details from AJV' }],
      };
    }
    this.logger.debug(this.compiledValidator.errors);
    return { valid: false, errors };
  }

  private mapAjvErrors(ajvErrors: ErrorObject[] | null | undefined): ValidationError[] {
    if (!ajvErrors) return [];
    // Deduplicate errors (anyOf schemas produce duplicates per variant).
    // Key includes `additionalProperty` so distinct extra keys at the same
    // path don't collapse to a single error.
    const seen = new Set<string>();
    return ajvErrors
      .map((err) => {
        const additionalProperty =
          err.keyword === 'additionalProperties' &&
          err.params &&
          typeof (err.params as { additionalProperty?: unknown }).additionalProperty === 'string'
            ? (err.params as { additionalProperty: string }).additionalProperty
            : undefined;
        const message = additionalProperty
          ? `${err.message || 'validation error'} (found: '${additionalProperty}')`
          : err.message || 'Unknown validation error';
        return {
          field: err.instancePath || '/',
          message,
          _dedupKey: `${err.instancePath}:${err.keyword}:${additionalProperty ?? ''}:${err.message ?? ''}`,
        };
      })
      .filter((err) => {
        if (seen.has(err._dedupKey)) return false;
        seen.add(err._dedupKey);
        return true;
      })
      .map(({ field, message }) => ({ field, message }));
  }
}
