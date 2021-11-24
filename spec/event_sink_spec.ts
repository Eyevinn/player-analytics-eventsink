import * as main from '../index';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';

const sqsMock = mockClient(SQSClient);

describe('event-sink module', () => {
  beforeEach(() => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/1234/test-queue';
    sqsMock.reset();
  });

  it('can validate an incoming POST request with a valid payload and push it to SQS', async () => {
    const sqsResp = { MessageId: '12345678-4444-5555-6666-111122223333' };
    const payload = {
      event: 'init',
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
    const event = {
      path: '/',
      body: JSON.stringify(payload),
      httpMethod: 'POST',
    };
    sqsMock
    .on(SendMessageCommand)
    .resolves(sqsResp);

    const response = await main.handler(event);
    expect(response.statusCode).toEqual(200);
    console.log(JSON.stringify(response.body));
    expect(response.body).toEqual(JSON.stringify(sqsResp));
  });

  it('can validate an incoming POST request with an invalid payload', async () => {
    const payload = {
      event: 'init',
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
    };
    const event = {
      path: '/',
      body: JSON.stringify(payload),
      httpMethod: 'POST',
    };
    const response = await main.handler(event);
    expect(response.statusCode).toEqual(400);
    expect(response.statusDescription).toEqual('Bad Request');
  });

  it('can validate an incoming POST request with a payload of an array with an invalid event', async () => {
    const payload = [
      {
        event: 'LIVE',
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
    const event = {
      path: '/',
      body: JSON.stringify(payload),
      httpMethod: 'POST',
    };
    const response = await main.handler(event);
    expect(response.statusCode).toEqual(400);
    expect(response.statusDescription).toEqual('Bad Request');
  });
});
