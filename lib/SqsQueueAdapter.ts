import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandInput,
} from '@aws-sdk/client-sqs';
import { AbstractQueueAdapter } from '../types/interfaces';
import winston from 'winston';

export default class SqsQueueAdapter implements AbstractQueueAdapter {
  logger: winston.Logger;
  client: SQSClient;

  constructor(logger: winston.Logger) {
    this.client = new SQSClient({ region: process.env.AWS_REGION });
    this.logger = logger;
  }

  async pushToQueue(event: Object): Promise<any> {
    if (process.env.SQS_QUEUE_URL === 'undefined') {
      this.logger.error('SQS_QUEUE_URL is undefined');
      return { message: 'SQS_QUEUE_URL is undefined' };
    }
    if (process.env.AWS_REGION === 'undefined') {
      this.logger.error('AWS_REGION is undefined');
      return { message: 'AWS_REGION is undefined' };
    }
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
      const sendMessageResult = await this.client.send(sendMessageCommand);
      this.logger.info(`Response from SQS: ${JSON.stringify(sendMessageResult)}`);
      return sendMessageResult;
    } catch (err) {
      this.logger.error(JSON.stringify(err));
      return err;
    }
  }
}
