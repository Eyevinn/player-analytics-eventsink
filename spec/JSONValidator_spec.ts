import Logger from '../logging/logger';
import { Validator } from '../Validator/JSONValidator';

const validEvent = {
  event: 'VOD',
  sessionId: '123-456-789',
  timestamp: -1,
  playhead: -1,
  duration: -1,
  payload: {
    live: false,
    contentId: '',
    contentUrl: '',
    drmType: '',
    userId: '',
    deviceId: '',
    deviceModel: '',
    deviceType: '',
  },
};
const invalidEvents = [
  {
    event: 'LIVE',
    sessionId: '123-456-987',
    timestamp: -1,
    playhead: 'test',
    duration: -1,
    payload: {
      live: true,
      contentId: 123,
      contentUrl: '',
      drmType: '',
      userId: '',
      deviceId: '',
      deviceModel: '',
      deviceType: '',
    },
  },
  {
    event: 'LIVE',
    sessionId: '123-125-987',
    timestamp: -1,
    playhead: 'test',
    duration: -1,
  },
  {
    event: 'LIVE',
    sessionId: '123-213-987',
    timestamp: -1,
    playhead: 'test',
    duration: -1,
    payload: {
      live: true,
      contentId: 123,
      contentUrl: '',
      drmType: '',
      userId: '',
      deviceId: '',
      deviceModel: '',
    },
  },
];

const validator = new Validator(Logger);

describe('JSONValidator', () => {
  it('validates a single event', async () => {
    const resp = validator.validateEvent(validEvent);
    expect(resp).toBe(true);
  });

  it('return false if an invalid event is provided', async () => {
    invalidEvents.forEach((event) => {
      const resp = validator.validateEvent(event);
      expect(resp).toBe(false);
    });
  });
});
