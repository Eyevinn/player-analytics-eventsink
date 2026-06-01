import Logger from '../logging/logger';
import { Validator } from '../lib/Validator';
import { valid_events, invalid_events } from './events/test_events';

const validator = new Validator(Logger);

describe('JSONValidator', () => {
  it('should return valid: true for valid events', async () => {
    for (const event of valid_events) {
      const result = validator.validateEvent(event);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    }
  });

  it('should return valid: false with errors for invalid events', async () => {
    for (const event of invalid_events) {
      const result = validator.validateEvent(event);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
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
    expect(result.errors).toBeDefined();

    // Should mention missing required properties
    const errorMessages = result.errors!.map((e) => e.message).join(' ');
    expect(errorMessages).toContain('required property');
  });

  it('should handle undefined event', () => {
    const result = validator.validateEvent(undefined);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0].message).toBe('Event is undefined');
  });

  it('should handle empty object', () => {
    const result = validator.validateEvent({});
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should reuse cached schema across calls (performance)', () => {
    // Validate multiple events rapidly — proves caching works
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      validator.validateEvent(valid_events[0]);
    }
    const elapsed = Date.now() - start;
    // 100 validations should complete in under 100ms with caching
    // (without caching, each AJV compile takes ~5-10ms = 500-1000ms)
    expect(elapsed).toBeLessThan(100);
  });
});
