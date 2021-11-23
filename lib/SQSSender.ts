import  { SQSClient, SendMessageCommand, SendMessageCommandOutput, SQSClientConfig} from "@aws-sdk/client-sqs";
import { EventSender } from '../types/interfaces';
import winston from 'winston';

export class SQSSender implements EventSender {
  logger: winston.Logger;
  SQSClient: SQSClient;

  constructor(logger: winston.Logger) {
    this.SQSClient = new SQSClient({ region: process.env.AWS_REGION });
    this.logger = logger;
  }

  async pushToQueue(event: any, isArray: boolean): Promise<any> {
    if (isArray) {
      const eventList = event as Array<any>;
      const eventListPromises = eventList.map(async (event) => {
        return await this.sendSQSMessage(event);
      });
      return await Promise.all(eventListPromises);
    }
    else {
      return await this.sendSQSMessage(event);
    }
  }

  async sendSQSMessage(message: any): Promise<SendMessageCommandOutput> {
    const params = {
      MessageAttributes: message,
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: "Player event"
    };
    const sendMessageCommand = new SendMessageCommand(params);
    try {
      const sendMessageResult = await this.SQSClient.send(sendMessageCommand);
      return sendMessageResult;
    }
    catch (err) {
      this.logger.error(err);
      return err;
    }
  }
}
