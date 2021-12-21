import Logger from '../logging/logger';
import { Validator } from '../lib/Validator';
import { valid_events, invalid_events } from './events/test_events';

const validator = new Validator(Logger);

describe('JSONValidator', () => {
  it('should return true if valid events are provided', async () => {
    for (const event of valid_events) {
      const resp = validator.validateEvent(event);
      expect(resp['body']['valid']).toBe(true);
    }
  });

  it('should return false if invalid events are provided', async () => {
    for (const event of invalid_events) {
      const resp = validator.validateEvent(event);
      expect(resp['body']['valid']).toBe(false);
    }
  });
});
