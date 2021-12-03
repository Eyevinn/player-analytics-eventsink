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

  async pushToQueue(event: Object): Promise<any> {
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
      this.logger.info(`Response from SQS: ${JSON.stringify(sendMessageResult)}`);
      return sendMessageResult;
    } catch (err) {
      this.logger.error(JSON.stringify(err));
      return err;
    }
  }
}
