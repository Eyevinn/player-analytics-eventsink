import { Lambda } from '../index';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import { valid_events, invalid_events } from './events/test_events';
import { SqsQueueAdapter } from '@eyevinn/player-analytics-shared';
import { fastify } from '../services/fastify';

const sqsMock = mockClient(SQSClient);
let request: any;

describe('event-sink lambda module', () => {
  beforeEach(() => {
    request = {
      path: '/',
      httpMethod: 'POST',
      clientIp: '2001:cdba::3257:9652',
      headers: {
        'User-Agent': 'test-agent',
        'Host': 'd123.cf.net',
        'Origin': 'https://test.domain.net'
      },
      body: '{}',
    };
    process.env.AWS_REGION = 'us-east-1';
    process.env.QUEUE_TYPE = 'SQS';
    process.env.SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/1234/test-queue';
    sqsMock.reset();
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
      expect(response.body).toEqual(
        '{"sessionId":"123-214-234","message":"Invalid player event","valid":false}'
      );
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
    expect(response.body).toEqual('{"sessionId":-1,"message":"Invalid player event","valid":false}');
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

  it('should validate allowed origin if CORS_ORIGIN is defined', async () => {
    process.env.CORS_ORIGIN = 'https://test.domain.net, http://test.domain.net';
    let event = request;
    event.path = '/';
    event.httpMethod = 'OPTIONS';
    const response = await Lambda.handler(event);
    if (response.headers) {
      expect(response.headers['Access-Control-Allow-Origin']).toEqual('https://test.domain.net');
      expect(response.headers['Vary']).toEqual('Origin');
    }
  });

  it('should not validate allowed origin if CORS_ORIGIN is not defined', async () => {
    delete process.env.CORS_ORIGIN;
    let event = request;
    event.path = '/';
    event.httpMethod = 'OPTIONS';
    const response = await Lambda.handler(event);
    if (response.headers) {
      expect(response.headers['Access-Control-Allow-Origin']).toEqual('*');
      expect(response.headers['Vary']).toBeUndefined();
    }
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

describe('event-sink fastify module', () => {
  it('should validate allowed origin if CORS_ORIGIN is defined', async () => {
    process.env.CORS_ORIGIN = 'https://test.domain.net, http://test.domain.net';
    const response = await fastify.inject({
      method: 'OPTIONS',
      url: '/',
      headers: {
        'origin': 'https://test.domain.net'
      }
    });
    if (response.headers) {
      expect(response.headers['access-control-allow-origin']).toEqual('https://test.domain.net');
      expect(response.headers['vary']).toEqual('Origin');
    }    
  });  
});