import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandOutput,
  SendMessageCommandInput,
} from '@aws-sdk/client-sqs';
import { EventSender } from '../types/interfaces';
import winston from 'winston';

export class SQSSender implements EventSender {
  logger: winston.Logger;
  SQSClient: SQSClient;

  constructor(logger: winston.Logger) {
    this.SQSClient = new SQSClient({ region: process.env.AWS_REGION });
    this.logger = logger;
  }

  async pushToQueue(body: any, isArray: boolean): Promise<any> {
    if (isArray) {
      const eventList = body as Array<any>;
      const eventListPromises = eventList.map(async (event) => {
        return await this.sendSQSMessage(event);
      });
      return await Promise.all(eventListPromises);
    } else {
      return await this.sendSQSMessage(body);
    }
  }

  async sendSQSMessage(event: Object): Promise<SendMessageCommandOutput> {
    const params: SendMessageCommandInput = {
      MessageAttributes: {
        Event: {
          DataType: 'String',
          StringValue: event['event'],
        },
        Time: {
          DataType: 'String',
          StringValue: event['timestamp'],
        },
      },
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(event),
    };
    const sendMessageCommand = new SendMessageCommand(params);
    try {
      const sendMessageResult = await this.SQSClient.send(sendMessageCommand);
      return sendMessageResult;
    } catch (err) {
      this.logger.error(err);
      return err;
    }
  }
}
