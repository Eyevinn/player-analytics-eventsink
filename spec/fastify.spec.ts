// Disable memory queue before any imports to ensure it's set during module initialization
process.env.DISABLE_MEMORY_QUEUE = 'true';

import { fastify } from '../services/fastify';
import { valid_events, invalid_events } from './events/test_events';
import { SqsQueueAdapter } from '@eyevinn/player-analytics-shared';

describe('Fastify server', () => {
  let originalHeartbeatInterval: string | undefined;

  beforeEach(() => {
    originalHeartbeatInterval = process.env.HEARTBEAT_INTERVAL;
    process.env.AWS_REGION = 'us-east-1';
    process.env.QUEUE_TYPE = 'SQS';
    process.env.SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/1234/test-queue';
    process.env.CORS_ALLOWED_ORIGINS = '';
  });

  afterEach(() => {
    process.env.CORS_ALLOWED_ORIGINS = '';
    if (originalHeartbeatInterval !== undefined) {
      process.env.HEARTBEAT_INTERVAL = originalHeartbeatInterval;
    } else {
      delete process.env.HEARTBEAT_INTERVAL;
    }
  });

  describe('OPTIONS / endpoint', () => {
    it('should validate allowed origin if CORS_ALLOWED_ORIGINS is defined', async () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://test.domain.net, http://test.domain.net';
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/',
        headers: {
          'origin': 'https://test.domain.net'
        }
      });
      if (response.headers) {
        expect(response.headers['access-control-allow-origin']).toEqual('https://test.domain.net');
      }
      process.env.CORS_ALLOWED_ORIGINS = '';
    });

    it('should return CORS headers for OPTIONS request', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/',
      });
      expect(response.statusCode).toEqual(200);
      expect(response.headers['access-control-allow-origin']).toEqual('*');
      expect(response.headers['access-control-allow-methods']).toEqual('POST, OPTIONS');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
      const body = JSON.parse(response.body);
      expect(body.status).toEqual('ok');
    });
  });

  describe('POST / endpoint', () => {
    beforeEach(() => {
      spyOn(SqsQueueAdapter.prototype, 'pushToQueue').and.callFake(function () {
        return Promise.resolve({
          MessageId: '12345678-4444-5555-6666-111122223333',
        });
      });
    });

    it('should return 200 with sessionId for valid event', async () => {
      const validEvent = valid_events[2]; // heartbeat event
      const response = await fastify.inject({
        method: 'POST',
        url: '/',
        payload: validEvent,
      });
      expect(response.statusCode).toEqual(200);
      const body = JSON.parse(response.body);
      expect(body.sessionId).toEqual('123-214-234');
      expect(body.valid).toEqual(true);
      expect(response.headers['x-epas-version']).toBeDefined();
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should return 200 with sessionId and heartbeatInterval for init event', async () => {
      const initEvent = valid_events[0]; // init event
      const response = await fastify.inject({
        method: 'POST',
        url: '/',
        payload: initEvent,
      });
      expect(response.statusCode).toEqual(200);
      const body = JSON.parse(response.body);
      expect(body.sessionId).toEqual('123-214-234');
      expect(body.heartbeatInterval).toEqual(5000); // default numeric value when env var not set
      expect(response.headers['x-epas-version']).toBeDefined();
    });

    it('should return 400 with error info for invalid event', async () => {
      const invalidEvent = invalid_events[0]; // missing required fields
      const response = await fastify.inject({
        method: 'POST',
        url: '/',
        payload: invalidEvent,
      });
      expect(response.statusCode).toEqual(400);
      const body = JSON.parse(response.body);
      expect(body.sessionId).toEqual('123-214-234');
      expect(body.message).toEqual('Invalid player event');
      expect(body.valid).toEqual(false);
    });

    it('should return 400 for malformed JSON', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/',
        payload: 'this is not valid json {',
        headers: {
          'content-type': 'application/json',
        },
      });
      expect(response.statusCode).toEqual(400);
      // Fastify's built-in parser returns "Bad Request" before reaching our handler
      expect(response.body).toContain('Bad Request');
    });

    it('should process all valid event types successfully', async () => {
      for (const validEvent of valid_events) {
        const response = await fastify.inject({
          method: 'POST',
          url: '/',
          payload: validEvent,
        });
        expect(response.statusCode).toEqual(200);
        const body = JSON.parse(response.body);
        if (validEvent.event === 'init') {
          expect(body.sessionId).toEqual('123-214-234');
          expect(body.heartbeatInterval).toBeDefined();
        } else {
          expect(body.sessionId).toEqual('123-214-234');
          expect(body.valid).toEqual(true);
        }
      }
    });
  });

  describe('GET /health endpoint', () => {
    it('should return 200 with stats', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });
      expect(response.statusCode).toEqual(200);
      expect(response.headers['content-type']).toContain('application/json');
      const body = JSON.parse(response.body);
      expect(body.status).toEqual('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.memoryQueue).toBeDefined();
      expect(body.memoryQueue.enabled).toEqual(false); // disabled in tests
    });
  });

  describe('Edge cases', () => {
    it('should return 404 for POST to wrong path', async () => {
      spyOn(SqsQueueAdapter.prototype, 'pushToQueue').and.callFake(function () {
        return Promise.resolve({
          MessageId: '12345678-4444-5555-6666-111122223333',
        });
      });
      const response = await fastify.inject({
        method: 'POST',
        url: '/invalid',
        payload: valid_events[0],
      });
      expect(response.statusCode).toEqual(404);
      expect(response.body).toContain('Not Found');
    });

    it('should return 405 Method Not Allowed for GET to /', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/',
      });
      expect(response.statusCode).toEqual(405);
      expect(response.body).toContain('Method Not Allowed');
    });

    it('should return CORS headers even for error responses', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/',
        payload: invalid_events[0],
      });
      expect(response.statusCode).toEqual(400);
      expect(response.headers['access-control-allow-origin']).toEqual('*');
      expect(response.headers['access-control-allow-methods']).toEqual('POST, OPTIONS');
    });
  });
});

