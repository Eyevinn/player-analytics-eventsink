import winston from 'winston';
import { EventSender } from '../types/interfaces';

export default class Sender implements EventSender {
  logger: winston.Logger;
  private sender: any;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   *
   * @param event the event object to send
   * @returns an object with the response from the event sender
   */
  async send(event: any): Promise<{}> {
    await this.getQueueAdapter();
    if (this.sender) {
      return this.sender.pushToQueue(event);
    } else {
      return {};
    }
  }

  private async getQueueAdapter() {
    let QueueAdapter: any;
    if (process.env.SQS_QUEUE_URL !== 'undefined') {
      QueueAdapter = (await import('./SqsQueueAdapter')).default;
    }
    if (QueueAdapter) {
      this.sender = new QueueAdapter(this.logger);
    } else {
      this.logger.warn('No event sender found');
      this.sender = null;
    }
  }
}
