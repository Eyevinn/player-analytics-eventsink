import Logger from '../logging/logger';
import { Validator } from '../lib/JSONValidator';
import { valid_events, invalid_events } from './events/events';

const validator = new Validator(Logger);

describe('JSONValidator', () => {
  it('return true if valid events are provided', async () => {
    for (const event of valid_events) {
      const resp = validator.validateEvent(event);
      expect(resp).toBe(true);
    }
  });

  it('return false if invalid events are provided', async () => {
    for (const event of invalid_events) {
      const resp = validator.validateEvent(event);
      expect(resp).toBe(false);
    }
  });
});
