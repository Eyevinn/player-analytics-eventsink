import winston from 'winston';
import { EventSender, QueueEvent } from '../types/interfaces';

export default class Sender implements EventSender {
  logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  async send(event: {}, isArray: boolean): Promise<{}> {
    let EventSender: any;
    let sender: QueueEvent;
    if (process.env.SQS_QUEUE_URL !== 'undefined') {
      EventSender = (await import('./SQSSender')).default;
    }
    if (!EventSender) {
      this.logger.error('No event sender found');
      return {};
    }
    sender = new EventSender(this.logger);
    return await sender.pushToQueue(event, isArray);
  }
}
