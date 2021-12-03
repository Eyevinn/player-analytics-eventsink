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
    await this.getSender();
    if (this.sender) {
      return this.sender.pushToQueue(event);
    } else {
      return {};
    }
  }

  private async getSender() {
    let EventSender: any;
    if (process.env.SQS_QUEUE_URL !== 'undefined') {
      EventSender = (await import('./SQSSender')).default;
    }
    if (EventSender) {
      this.sender = new EventSender(this.logger);
    } else {
      this.logger.error('No event sender found');
      this.sender = null;
    }
  }
}
