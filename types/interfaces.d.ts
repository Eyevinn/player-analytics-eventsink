import winston from "winston";
import  { SQSClient, SendMessageCommandOutput } from "@aws-sdk/client-sqs";

export interface EventValidator {
  logger: winston.Logger;
  eventSchema: any;
  validateEvent(event: Object): any;
  validateEventList(eventList: Array<Object>): any;
}

export interface EventSender {
  logger: winston.Logger;
  SQSClient: SQSClient;
  pushToQueue(body: Object, isArray: boolean): Promise<any>;
  sendSQSMessage(event: Object): Promise<SendMessageCommandOutput>;
}
