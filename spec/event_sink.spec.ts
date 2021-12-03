import * as main from '../index';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import { valid_events, invalid_events } from './events/events';

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
    process.env.SQS_QUEUE_URL =
      'https://sqs.us-east-1.amazonaws.com/1234/test-queue';
    sqsMock.reset();
  });

  it('can validate an incoming POST request with a valid payload and push it to SQS', async () => {
    const sqsResp = { MessageId: '12345678-4444-5555-6666-111122223333' };
    const event = request;
    for (const payload of valid_events) {
      event.body = JSON.stringify(payload);
      sqsMock.on(SendMessageCommand).resolves(sqsResp);

      const response = await main.handler(event);
      expect(response.statusCode).toEqual(200);
      expect(response.body).toEqual(JSON.stringify(sqsResp));
    }
  });

  it('can validate an incoming POST request with an invalid payload', async () => {
    const event = request;
    for (const payload of invalid_events) {
      event.body = JSON.stringify(payload);
      const response = await main.handler(event);
      expect(response.statusCode).toEqual(400);
      expect(response.statusDescription).toEqual('Bad Request');
    }
  });

  it('should ignore request if "path" != "/" ', async () => {
    const event = request;
    event.path = '/validate';
    event.body = JSON.stringify({ event: 'live-event' });
    const response = await main.handler(event);
    expect(response.statusCode).toEqual(200);
    expect(response.statusDescription).toEqual('OK');
  });

  it('should not push to SQS queue if env is not set', async () => {
    process.env.SQS_QUEUE_URL = undefined;
    const sqsResp = { MessageId: '12345678-4444-5555-6666-111122223333' };
    const event = request;
    event.path = '/';
    event.body = JSON.stringify({
      event: 'loading',
      timestamp: 0,
      playhead: 0,
      duration: 0,
    });

    sqsMock.on(SendMessageCommand).resolves(sqsResp);
    const response = await main.handler(event);
    expect(response.statusCode).toEqual(200);
    expect(response.statusDescription).toEqual('OK');
    expect(sqsMock.calls()).toHaveSize(0);
    expect(response.body).toEqual('{}');
  });

  it('can validate an incoming POST request with a payload of an array with an invalid event', async () => {
    const payload = [
      {
        event: 'resume',
        sessionId: 789,
        timestamp: -1,
        playhead: -1,
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
      },
      {
        // valid Event
        event: 'init',
        sessionId: '123-456-789',
        timestamp: -1,
        playhead: -1,
        duration: -1,
        payload: {
          live: true,
          contentId: '',
          contentUrl: '',
          drmType: '',
          userId: '',
          deviceId: '',
          deviceModel: '',
          deviceType: '',
        },
      },
    ];
    const event = request;
    event.body = JSON.stringify(payload);
    const response = await main.handler(event);
    expect(response.statusCode).toEqual(400);
    expect(response.statusDescription).toEqual('Bad Request');
  });
});
