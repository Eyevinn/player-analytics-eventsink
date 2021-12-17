import * as main from "../services/lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import { valid_events, invalid_events } from "./events/test_events";
import { SqsQueueAdapter } from "@eyevinn/player-analytics-shared";

const sqsMock = mockClient(SQSClient);
let request: any;

describe("event-sink module", () => {
  beforeEach(() => {
    request = {
      path: "/",
      httpMethod: "POST",
      clientIp: "2001:cdba::3257:9652",
      headers: {
        "user-agent": [
          {
            key: "User-Agent",
            value: "test-agent",
          },
        ],
        host: [
          {
            key: "Host",
            value: "d123.cf.net",
          },
        ],
      },
      body: "{}",
    };
    process.env.AWS_REGION = "us-east-1";
    process.env.QUEUE_TYPE = "SQS";
    process.env.SQS_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/1234/test-queue";
    sqsMock.reset();
  });

  it("can validate an incoming POST request with a valid payload and push it to SQS", async () => {
    spyOn(SqsQueueAdapter.prototype, "pushToQueue").and.callFake(function () {
      return Promise.resolve({
        MessageId: "12345678-4444-5555-6666-111122223333",
      });
    });
    const sqsResp = { MessageId: "12345678-4444-5555-6666-111122223333" };
    const event = request;
    for (const payload of valid_events) {
      event.body = JSON.stringify(payload);
      sqsMock.on(SendMessageCommand).resolves(sqsResp);
      const response = await main.handler(event);
      expect(response.statusCode).toEqual(200);
      expect(response.body).toEqual(
        JSON.stringify({ validEvent: true, SQS: sqsResp })
      );
    }
  });

  it("can validate an incoming POST request with an invalid payload", async () => {
    spyOn(SqsQueueAdapter.prototype, "pushToQueue").and.callFake(function () {
      return Promise.resolve({
        message: "Invalid player event",
      });
    });
    const event = request;
    for (const payload of invalid_events) {
      event.body = JSON.stringify(payload);
      const response = await main.handler(event);
      expect(response.statusCode).toEqual(400);
      expect(response.statusDescription).toEqual("Bad Request");
      expect(response.body).toEqual(
        '{"message":"Invalid player event","validEvent":false}'
      );
    }
  });

  xit("can validate an incoming POST request with an invalid payload with multiple events", async () => {
    spyOn(SqsQueueAdapter.prototype, "pushToQueue").and.callFake(function () {
      return Promise.resolve({
        message: "Invalid player event",
      });
    });
    const event = request;
    event.body = JSON.stringify({
      event: "heartbeat",
      sessionId: "",
      timestamp: 0,
      playhead: 0,
      duration: 0,
      payload: {
        events: [
          {
            // valid event
            event: "loading",
            timestamp: 0,
            playhead: 0,
            duration: 0,
          },
          {
            // invalid event
            event: "loaded",
            timestamp: 0,
          },
        ],
      },
    });
    const response = await main.handler(event);
    expect(response.statusCode).toEqual(400);
    expect(response.statusDescription).toEqual("Bad Request");
    expect(response.body).toEqual(
      '{"message":"Invalid player event","validEvent":false}'
    );
  });

  it("can validate an incoming POST request with an empty payload", async () => {
    spyOn(SqsQueueAdapter.prototype, "pushToQueue").and.callFake(function () {
      return Promise.resolve({
        message: "Invalid player event",
      });
    });
    const event = request;
    event.body = JSON.stringify({});
    const response = await main.handler(event);
    expect(response.statusCode).toEqual(400);
    expect(response.statusDescription).toEqual("Bad Request");
    expect(response.body).toEqual(
      '{"message":"Invalid player event","validEvent":false}'
    );
  });

  it('should ignore request if "path" != "/" ', async () => {
    const event = request;
    event.path = "/validate";
    event.body = JSON.stringify({ event: "live-event" });
    const response = await main.handler(event);
    expect(response.statusCode).toEqual(200);
    expect(response.statusDescription).toEqual("OK");
    expect(response.body).toEqual("{}");
  });

  it("should not push to SQS queue if sqs queue env is not set", async () => {
    spyOn(SqsQueueAdapter.prototype, "pushToQueue").and.callFake(function () {
      return Promise.resolve({
        message: "SQS_QUEUE_URL is undefined",
      });
    });

    process.env.SQS_QUEUE_URL = undefined;
    const sqsResp = { MessageId: "12345678-4444-5555-6666-111122223333" };
    const event = request;
    event.path = "/";
    event.body = JSON.stringify(valid_events[0]);

    sqsMock.on(SendMessageCommand).resolves(sqsResp);
    const response = await main.handler(event);
    expect(response.statusCode).toEqual(200);
    expect(response.statusDescription).toEqual("OK");
    expect(sqsMock.calls()).toHaveSize(0);
    expect(response.body).toEqual(
      '{"validEvent":true,"SQS":{"message":"SQS_QUEUE_URL is undefined"}}'
    );
  });

  it("should not push to SQS queue if AWS region env is not set", async () => {
    spyOn(SqsQueueAdapter.prototype, "pushToQueue").and.callFake(function () {
      return Promise.resolve({
        message: "AWS_REGION is undefined",
      });
    });

    process.env.AWS_REGION = undefined;
    const sqsResp = { MessageId: "12345678-4444-5555-6666-111122223333" };
    const event = request;
    event.path = "/";
    event.body = JSON.stringify(valid_events[0]);

    sqsMock.on(SendMessageCommand).resolves(sqsResp);
    const response = await main.handler(event);
    expect(response.statusCode).toEqual(200);
    expect(response.statusDescription).toEqual("OK");
    expect(sqsMock.calls()).toHaveSize(0);
    expect(response.body).toEqual(
      '{"validEvent":true,"SQS":{"message":"AWS_REGION is undefined"}}'
    );
  });

  it("should not push to queue if queue env is not set", async () => {
    spyOn(SqsQueueAdapter.prototype, "pushToQueue").and.callFake(function () {
      return Promise.resolve({
        message: "No queue type specified",
      });
    });
    process.env.QUEUE_TYPE = undefined;
    const sqsResp = { MessageId: "12345678-4444-5555-6666-111122223333" };
    const event = request;
    event.path = "/";
    event.body = JSON.stringify(valid_events[0]);

    sqsMock.on(SendMessageCommand).resolves(sqsResp);
    const response = await main.handler(event);
    expect(response.statusCode).toEqual(200);
    expect(response.statusDescription).toEqual("OK");
    expect(sqsMock.calls()).toHaveSize(0);
    expect(response.body).toEqual(
      '{"validEvent":true,"SQS":{"message":"No queue type specified"}}'
    );
  });
});
