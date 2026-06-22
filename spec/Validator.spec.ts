import Logger from '../logging/logger';
import { Validator } from '../lib/Validator';
import { valid_events, invalid_events } from './events/test_events';

const validator = new Validator(Logger);

describe('JSONValidator', () => {
  it('should return true if valid events are provided', async () => {
    for (const event of valid_events) {
      const resp = validator.validateEvent(event);
      expect(resp).toBe(true);
    }
  });

  it('should return false if invalid events are provided', async () => {
    for (const event of invalid_events) {
      const resp = validator.validateEvent(event);
      expect(resp).toBe(false);
    }
  });

  it('should accept metadata events with custom string fields (additionalProperties)', () => {
    const metadataWithCustomFields = {
      event: 'metadata',
      sessionId: 'test-session',
      timestamp: 1000,
      playhead: 0,
      duration: 120,
      payload: {
        live: false,
        contentTitle: 'Test Video',
        customMetadataId: '42',       // custom string field
        customCategory: 'sports',     // custom string field
        isPromoted: true,             // custom boolean field
      },
    };
    expect(validator.validateEvent(metadataWithCustomFields)).toBe(true);
  });

  it('should reject metadata events with integer custom fields (spec limitation)', () => {
    const metadataWithIntegerField = {
      event: 'metadata',
      sessionId: 'test-session',
      timestamp: 1000,
      playhead: 0,
      duration: 120,
      payload: {
        live: false,
        contentTitle: 'Test Video',
        customMetadataId: 42,         // integer — NOT allowed by EPAS v0.5.0 schema
      },
    };
    // EPAS v0.5.0 additionalProperties only allows ["string", "boolean"]
    // Integers must be sent as strings (e.g., "42") to pass validation
    expect(validator.validateEvent(metadataWithIntegerField)).toBe(false);
  });
});
