import * as main from '../index';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import { valid_events, invalid_events } from './events/events';

const sqsMock = mockClient(SQSClient);
let record: any;

describe('event-sink module', () => {
  beforeEach(() => {
    record = {
      Records: [
        {
          cf: {
            config: {
              distributionId: 'EVENT',
            },
            request: {
              uri: '/',
              method: 'POST',
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
              body: {},
            },
          },
        },
      ],
    };
    process.env.AWS_REGION = 'us-east-1';
    process.env.SQS_QUEUE_URL =
      'https://sqs.us-east-1.amazonaws.com/1234/test-queue';
    sqsMock.reset();
  });

  it('can validate an incoming POST request with a valid payload and push it to SQS', async () => {
    const sqsResp = { MessageId: '12345678-4444-5555-6666-111122223333' };
    const event = record;
    for (const payload of valid_events) {
      event.Records[0].cf.request.body = payload;
      sqsMock.on(SendMessageCommand).resolves(sqsResp);

      const response = await main.handler(event, null);
      expect(response.status).toEqual('200');
      expect(response.body).toEqual(JSON.stringify(sqsResp));
    }
  });

  it('can validate an incoming POST request with an invalid payload', async () => {
    const event = record;
    for (const payload of invalid_events) {
      event.Records[0].cf.request.body = payload;
      const response = await main.handler(event, null);
      expect(response.status).toEqual('400');
      expect(response.statusDescription).toEqual('Bad Request');
    }
  });

  it('should ignore request if "uri" != "/" ', async () => {
    const event = record;
    event.Records[0].cf.request.uri = '/validate';
    event.Records[0].cf.request.body = { event: 'live-event' };
    const response = await main.handler(event, null);
    expect(response.status).toEqual('200');
    expect(response.statusDescription).toEqual('OK');
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
      { // valid Event
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
    const event = record;
    event.Records[0].cf.request.body = payload;
    const response = await main.handler(event, null);
    expect(response.status).toEqual('400');
    expect(response.statusDescription).toEqual('Bad Request');
  });
});
