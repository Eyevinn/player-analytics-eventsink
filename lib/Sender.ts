import winston from 'winston';

export class Sender {
  logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   *
   * @param event the event object to send
   * @returns an object with the response from the event sender or an empty object if there was an error
   */
  async send(event: Object): Promise<Object> {
    let QueueAdapter: any;
    let queue: any;

    switch (process.env.QUEUE_TYPE) {
      case 'SQS':
        QueueAdapter = (await import('player-analytics-shared/adapters/SqsQueueAdapter')).default;
        break;
      default:
        this.logger.warn('No queue type specified');
        return { message: 'No queue type specified' };
    }
    queue = new QueueAdapter(this.logger);
    return queue.pushToQueue(event);
  }
}
