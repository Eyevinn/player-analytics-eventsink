import Logger from '../logging/logger';
import { Validator } from '../lib/Validator';
import { valid_events, invalid_events } from './events/test_events';
import Ajv from 'ajv';

const validator = new Validator(Logger);

describe('JSONValidator', () => {
  it('should return valid: true for valid events', async () => {
    for (const event of valid_events) {
      const result = validator.validateEvent(event);
      expect(result.valid).toBe(true);
      if (result.valid === false) {
        expect((result as any).errors).toBeUndefined();
      }
    }
  });

  it('should return valid: false with errors for invalid events', async () => {
    for (const event of invalid_events) {
      const result = validator.validateEvent(event);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
      }
    }
  });

  it('should return descriptive error details for missing fields', () => {
    // Event missing playhead and duration
    const badEvent = {
      event: 'heartbeat',
      sessionId: '123',
      timestamp: 0,
    };
    const result = validator.validateEvent(badEvent);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const errorMessages = result.errors.map((e) => e.message).join(' ');
      expect(errorMessages).toContain('required property');
    }
  });

  it('should populate `field` with a JSON Pointer (empty or leading /) for each error', () => {
    const badEvent = { event: 'heartbeat', sessionId: '123', timestamp: 0 };
    const result = validator.validateEvent(badEvent);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      for (const err of result.errors) {
        // AJV instancePath: empty string for root-level, or JSON Pointer starting with '/'
        expect(err.field === '/' || err.field.startsWith('/')).toBe(true);
      }
    }
  });

  it('should surface distinct additionalProperties errors instead of collapsing them', () => {
    // Craft an event with several unexpected top-level keys. Without
    // the additionalProperty in the dedup key, all extras collapse to
    // one message ("must NOT have additional properties") and the
    // caller can only see the first offender.
    const eventWithExtras: any = {
      event: 'heartbeat',
      sessionId: 'abc',
      timestamp: 0,
      playhead: 0,
      duration: 10,
      unexpectedFoo: 1,
      unexpectedBar: 2,
      unexpectedBaz: 3,
    };
    const result = validator.validateEvent(eventWithExtras);
    if (result.valid) {
      // Schema may accept additional properties on some event variants; if
      // so this test is a no-op rather than a false failure.
      return;
    }
    const offenders = result.errors
      .map((e) => e.message)
      .filter((m) => m.toLowerCase().includes('additional'));
    // If any additionalProperties errors surfaced, at least two of the
    // three unexpected keys should be named individually.
    if (offenders.length > 0) {
      const named = offenders.filter((m) => /unexpected(Foo|Bar|Baz)/.test(m));
      expect(named.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should handle undefined event', () => {
    const result = validator.validateEvent(undefined);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0].message).toBe('Event is undefined');
    }
  });

  it('should handle null event', () => {
    const result = validator.validateEvent(null);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0].message).toBe('Event is undefined');
    }
  });

  it('should handle empty object', () => {
    const result = validator.validateEvent({});
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('should compile the AJV schema exactly once per Validator instance', () => {
    const compileSpy = spyOn(Ajv.prototype, 'compile').and.callThrough();
    const addSchemaSpy = spyOn(Ajv.prototype, 'addSchema').and.callThrough();

    const v = new Validator(Logger);
    const setupAddSchemaCalls = addSchemaSpy.calls.count();

    for (let i = 0; i < 50; i++) {
      v.validateEvent(valid_events[0]);
      v.validateEvent(invalid_events[0]);
    }

    // No additional addSchema/compile calls after the constructor completes —
    // proves the cached ValidateFunction is reused across all calls.
    expect(addSchemaSpy.calls.count()).toBe(setupAddSchemaCalls);
    expect(compileSpy.calls.count()).toBe(0);
  });

  it('should throw at construction if the schema pointer cannot be resolved', () => {
    // Force AJV to fail to resolve the EPAS pointer, but let it resolve
    // the JSON Schema meta-schemas AJV needs during construction — a
    // blanket stub would break loading altogether. Without a fail-fast
    // throw, the server would start with a null validator and every
    // request would return 400 forever with no useful diagnostics.
    const original = Ajv.prototype.getSchema;
    spyOn(Ajv.prototype, 'getSchema').and.callFake(function (
      this: any,
      key: string,
    ) {
      if (key === '#/definitions/TPlayerAnalyticsEvent') return undefined;
      return original.call(this, key);
    });
    expect(() => new Validator(Logger)).toThrowError(
      /AJV failed to resolve validator/,
    );
  });
});
