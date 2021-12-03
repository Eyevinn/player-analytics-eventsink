import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandInput,
} from '@aws-sdk/client-sqs';
import { QueueEvent } from '../types/interfaces';
import winston from 'winston';

export default class SQSEvent implements QueueEvent {
  logger: winston.Logger;
  Client: SQSClient;

  constructor(logger: winston.Logger) {
    this.Client = new SQSClient({ region: process.env.AWS_REGION });
    this.logger = logger;
  }

  async pushToQueue(body: any, isArray: boolean): Promise<any> {
    if (isArray) {
      const eventList = body as Array<any>;
      const eventListPromises = eventList.map(async (event) => {
        return await this.sendMessage(event);
      });
      return await Promise.all(eventListPromises);
    } else {
      return await this.sendMessage(body);
    }
  }

  async sendMessage(event: Object): Promise<{}> {
    const params: SendMessageCommandInput = {
      MessageAttributes: {
        Event: {
          DataType: 'String',
          StringValue: event['event'],
        },
        Time: {
          DataType: 'String',
          StringValue: event['timestamp']
            ? event['timestamp']
            : new Date().toISOString(),
        },
      },
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(event),
    };
    const sendMessageCommand = new SendMessageCommand(params);
    try {
      const sendMessageResult = await this.Client.send(sendMessageCommand);
      return sendMessageResult;
    } catch (err) {
      this.logger.error(err);
      return err;
    }
  }
}
