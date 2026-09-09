// Disable memory queue before any imports to ensure it's set during module initialization
process.env.DISABLE_MEMORY_QUEUE = 'true';

import { Lambda } from '../index';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import { valid_events, invalid_events } from './events/test_events';
import { SqsQueueAdapter } from '@eyevinn/player-analytics-shared';
import { generateResponseHeaders } from '../lib/route-helpers';

const sqsMock = mockClient(SQSClient);
let request: any;

describe('event-sink module', () => {
  beforeEach(() => {
    request = {
      path: '/',
      httpMethod: 'POST',
      clientIp: '2001:cdba::3257:9652',
      headers: {
        'user-agent': [
          {
            key: 'User-Agent',
            value: 'test-agent',
          },
        ],
        host: [
          {
            key: 'Host',
            value: 'd123.cf.net',
          },
        ],
      },
      body: '{}',
    };
    process.env.AWS_REGION = 'us-east-1';
    process.env.QUEUE_TYPE = 'SQS';
    process.env.SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/1234/test-queue';
    sqsMock.reset();
  });


  it('can generate valid response headers', () => {
    // Wildcard mode (no CORS_ALLOWED_ORIGINS) — no Vary header needed
    process.env.CORS_ALLOWED_ORIGINS = '';
    const responseHeaders = generateResponseHeaders();
    expect(responseHeaders['Content-Type']).toEqual('application/json');
    expect(responseHeaders['Access-Control-Allow-Origin']).toEqual('*');
    expect(responseHeaders['Access-Control-Allow-Headers']).toEqual('Content-Type, Origin, X-EPAS-Event, X-EPAS-Version');
    expect(responseHeaders['Access-Control-Allow-Methods']).toEqual('POST, OPTIONS');
    expect(responseHeaders['X-EPAS-Version']).not.toBeNull();
    expect(responseHeaders['Vary']).not.toBeDefined();

    const responseHeadersWithOrigin = generateResponseHeaders('https://example.com');
    expect(responseHeadersWithOrigin['Access-Control-Allow-Origin']).toEqual('*');
    expect(responseHeadersWithOrigin['Vary']).not.toBeDefined();

    // Dynamic CORS — Vary: Origin must be present
    process.env.CORS_ALLOWED_ORIGINS = 'https://example.com, https://mydomain.com';
    const responseHeadersWithAllowedOrigin = generateResponseHeaders('https://mydomain.com');
    expect(responseHeadersWithAllowedOrigin['Content-Type']).toEqual('application/json');
    expect(responseHeadersWithAllowedOrigin['Access-Control-Allow-Origin']).toEqual('https://mydomain.com');
    expect(responseHeadersWithAllowedOrigin['Access-Control-Allow-Headers']).toEqual('Content-Type, Origin, X-EPAS-Event, X-EPAS-Version');
    expect(responseHeadersWithAllowedOrigin['Access-Control-Allow-Methods']).toEqual('POST, OPTIONS');
    expect(responseHeadersWithAllowedOrigin['X-EPAS-Version']).not.toBeNull();
    expect(responseHeadersWithAllowedOrigin['Vary']).toEqual('Origin');

    // Not-allowed origin — still needs Vary: Origin (CDN must know to vary)
    const responseHeadersWithNotAllowedOrigin = generateResponseHeaders('https://notallowed.com');
    expect(responseHeadersWithNotAllowedOrigin['Content-Type']).toEqual('application/json');
    expect(responseHeadersWithNotAllowedOrigin['Access-Control-Allow-Origin']).not.toBeDefined();
    expect(responseHeadersWithNotAllowedOrigin['Vary']).toEqual('Origin');
    process.env.CORS_ALLOWED_ORIGINS = '';
  });

  it('can validate an incoming POST request with a valid payload and push it to SQS', async () => {
    spyOn(SqsQueueAdapter.prototype, 'pushToQueue').and.callFake(function () {
      return Promise.resolve({
        MessageId: '12345678-4444-5555-6666-111122223333',
      });
    });
    const sqsResp = { MessageId: '12345678-4444-5555-6666-111122223333' };
    const event = request;
    for (const payload of valid_events) {
      event.body = JSON.stringify(payload);
      sqsMock.on(SendMessageCommand).resolves(sqsResp);
      const response = await Lambda.handler(event);
      if (response.statusCode === 400) console.log(response.body);
      expect(response.statusCode).toEqual(200);
      if (response.headers) {
        expect(response.headers["X-EPAS-Version"]).not.toBeNull();
      }
      if (payload.event === 'init') {
        expect(response.body).toContain('"sessionId":"123-214-234"');
        expect(response.body).toContain('"heartbeatInterval":5000');
      } else {
        expect(response.body).toContain('"sessionId":"123-214-234"');
        expect(response.body).toContain('"valid":true');
        expect(response.body).toContain('"MessageId":"12345678-4444-5555-6666-111122223333"');
      }
    }
  });

  it('forwards a metadata event carrying customMetadataId unchanged to the queue', async () => {
    // End-to-end proof for #72: a metadata event with the optional numeric
    // customMetadataId must (a) pass validation against the pinned EPAS
    // schema and (b) reach the queue adapter with the field preserved —
    // eventsink forwards events unchanged; it never strips fields.
    let forwardedEvent: any = null;
    spyOn(SqsQueueAdapter.prototype, 'pushToQueue').and.callFake(function (
      forwarded: any,
    ) {
      forwardedEvent = forwarded;
      return Promise.resolve({
        MessageId: '12345678-4444-5555-6666-111122223333',
      });
    });

    const metadataEvent = {
      event: 'metadata',
      sessionId: '123-214-234',
      timestamp: -1,
      playhead: -1,
      duration: -1,
      payload: {
        live: false,
        contentTitle: 'My Content',
        customMetadataId: 4242,
      },
    };

    const event = request;
    event.body = JSON.stringify(metadataEvent);
    sqsMock.on(SendMessageCommand).resolves({
      MessageId: '12345678-4444-5555-6666-111122223333',
    });

    const response = await Lambda.handler(event);
    if (response.statusCode === 400) console.log(response.body);

    // Validation passed end-to-end.
    expect(response.statusCode).toEqual(200);
    expect(response.body).toContain('"valid":true');

    // The exact object handed to the queue adapter still carries the field,
    // with its numeric value intact (no stripping, no coercion).
    expect(forwardedEvent).not.toBeNull();
    expect(forwardedEvent.event).toEqual('metadata');
    expect(forwardedEvent.payload.customMetadataId).toEqual(4242);
  });

  it('can validate an incoming POST request with an invalid payload', async () => {
    spyOn(SqsQueueAdapter.prototype, 'pushToQueue').and.callFake(function () {
      return Promise.resolve({
        message: 'Invalid player event',
      });
    });
    const event = request;
    for (const payload of invalid_events) {
      event.body = JSON.stringify(payload);
      const response = await Lambda.handler(event);
      expect(response.statusCode).toEqual(400);
      expect(response.statusDescription).toEqual('Bad Request');
      const body = JSON.parse(response.body!);
      expect(body.sessionId).toEqual('123-214-234');
      expect(body.message).toEqual('Invalid player event');
      expect(body.valid).toBe(false);
      expect(body.errors).toBeDefined();
      expect(body.errors.length).toBeGreaterThan(0);
    }
  });

  it('can validate an incoming POST request with an empty payload', async () => {
    spyOn(SqsQueueAdapter.prototype, 'pushToQueue').and.callFake(function () {
      return Promise.resolve({
        message: 'Invalid player event',
      });
    });
    const event = request;
    event.body = JSON.stringify({});
    const response = await Lambda.handler(event);
    expect(response.statusCode).toEqual(400);
    expect(response.statusDescription).toEqual('Bad Request');
    const body = JSON.parse(response.body!);
    // #86: a genuinely-missing sessionId falls back to an empty string, never
    // the number -1 — the response contract types this field as a string.
    expect(body.sessionId).toEqual('');
    expect(typeof body.sessionId).toEqual('string');
    expect(body.message).toEqual('Invalid player event');
    expect(body.valid).toBe(false);
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it('should dismiss request if "path" != "/" ', async () => {
    const event = request;
    event.path = '/validate';
    event.body = JSON.stringify({ event: 'live-event' });
    const response = await Lambda.handler(event);
    expect(response.statusCode).toEqual(404);
    expect(response.statusDescription).toEqual('Not Found');
    expect(response.body).toContain('Invalid');
  });

  it('should not push to SQS queue if sqs queue env is not set', async () => {
    spyOn(SqsQueueAdapter.prototype, 'pushToQueue').and.callFake(function () {
      return Promise.resolve({
        message: 'SQS_QUEUE_URL is undefined',
      });
    });

    process.env.SQS_QUEUE_URL = undefined;
    const sqsResp = { MessageId: '12345678-4444-5555-6666-111122223333' };
    const event = request;
    event.path = '/';
    event.body = JSON.stringify(valid_events[4]);

    sqsMock.on(SendMessageCommand).resolves(sqsResp);
    const response = await Lambda.handler(event);
    expect(response.statusCode).toEqual(200);
    expect(response.statusDescription).toEqual('OK');
    expect(sqsMock.calls()).toHaveSize(0);
    expect(response.body).toContain('SQS_QUEUE_URL is undefined');
  });

  it('should not push to SQS queue if AWS region env is not set', async () => {
    spyOn(SqsQueueAdapter.prototype, 'pushToQueue').and.callFake(function () {
      return Promise.resolve({
        message: 'AWS_REGION is undefined',
      });
    });

    process.env.AWS_REGION = undefined;
    const sqsResp = { MessageId: '12345678-4444-5555-6666-111122223333' };
    const event = request;
    event.path = '/';
    event.body = JSON.stringify(valid_events[1]);

    sqsMock.on(SendMessageCommand).resolves(sqsResp);
    const response = await Lambda.handler(event);
    expect(response.statusCode).toEqual(200);
    expect(response.statusDescription).toEqual('OK');
    expect(sqsMock.calls()).toHaveSize(0);
    expect(response.body).toContain('AWS_REGION is undefined');
  });

  it('should not push to queue if queue env is not set', async () => {
    spyOn(SqsQueueAdapter.prototype, 'pushToQueue').and.callFake(function () {
      return Promise.resolve({
        message: 'No queue type specified',
      });
    });
    process.env.QUEUE_TYPE = undefined;
    const sqsResp = { MessageId: '12345678-4444-5555-6666-111122223333' };
    const event = request;
    event.path = '/';
    event.body = JSON.stringify(valid_events[1]);

    sqsMock.on(SendMessageCommand).resolves(sqsResp);
    const response = await Lambda.handler(event);
    expect(response.statusCode).toEqual(200);
    expect(response.statusDescription).toEqual('OK');
    expect(sqsMock.calls()).toHaveSize(0);
    expect(response.body).toContain('No queue type specified');
  });
});
