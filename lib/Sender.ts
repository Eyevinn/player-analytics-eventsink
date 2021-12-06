import winston from 'winston';
import { EventSender } from '../types/interfaces';

export default class Sender implements EventSender {
  logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   *
   * @param event the event object to send
   * @returns an object with the response from the event sender
   */
  async send(event: Object): Promise<Object> {
    let QueueAdapter: any;
    let queue: any;

    switch (process.env.QUEUE_TYPE) {
      case 'SQS':
        QueueAdapter = (await import('./SqsQueueAdapter')).default;
        break;
      default:
        this.logger.warn('No queue type specified');
        return {};
    }
    queue = new QueueAdapter(this.logger);
    return queue.pushToQueue(event);
  }
}
