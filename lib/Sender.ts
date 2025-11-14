import winston from 'winston';

export default class Sender {
  logger: winston.Logger;
  private static queueAdapterCache: Map<string, any> = new Map();
  private static queueAdapterPromises: Map<string, Promise<any>> = new Map();

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  private async getQueueAdapter(queueType: string): Promise<any> {
    if (Sender.queueAdapterCache.has(queueType)) {
      return Sender.queueAdapterCache.get(queueType);
    }

    if (Sender.queueAdapterPromises.has(queueType)) {
      return await Sender.queueAdapterPromises.get(queueType);
    }

    const adapterPromise = this.createQueueAdapter(queueType);
    Sender.queueAdapterPromises.set(queueType, adapterPromise);

    try {
      const adapter = await adapterPromise;
      Sender.queueAdapterCache.set(queueType, adapter);
      Sender.queueAdapterPromises.delete(queueType);
      return adapter;
    } catch (error) {
      Sender.queueAdapterPromises.delete(queueType);
      throw error;
    }
  }

  private async createQueueAdapter(queueType: string): Promise<any> {
    let QueueAdapter: any;

    switch (queueType) {
      case 'SQS':
        QueueAdapter = (await import('@eyevinn/player-analytics-shared')).SqsQueueAdapter;
        break;
      case 'beanstalkd':
        QueueAdapter = (await import('@eyevinn/player-analytics-shared')).BeanstalkdAdapter;
        break;
      case 'redis':
        QueueAdapter = (await import('@eyevinn/player-analytics-shared')).RedisAdapter;
        break;
      default:
        throw new Error('No queue type specified');
    }

    return new QueueAdapter(this.logger);
  }

  /**
   *
   * @param event the event object to send
   * @returns an object with the response from the event sender or an empty object if there was an error
   */
  async send(event: Object): Promise<Object> {
    const queueType = process.env.QUEUE_TYPE;
    
    if (!queueType) {
      this.logger.warn('No queue type specified');
      return { message: 'No queue type specified' };
    }

    try {
      const queue = await this.getQueueAdapter(queueType);
      const queueTs = Date.now();
      const queueResponse = await queue.pushToQueue(event);
      const timeTaken = Date.now() - queueTs;
      
      this.logger.debug(`Time taken to run "await queue.pushToQueue(event)"-> ${timeTaken}ms`);
      
      if (timeTaken > 5000) {
        this.logger.error(`Queue operation took ${timeTaken}ms (> 5 seconds) - this indicates a serious performance issue`);
      } else if (timeTaken > 2000) {
        this.logger.warn(`Queue operation took ${timeTaken}ms (> 2 seconds) - performance may be degraded`);
      }
      
      return queueResponse;
    } catch (error) {
      this.logger.error('Error getting queue adapter:', error);
      return { message: error.message };
    }
  }
}
