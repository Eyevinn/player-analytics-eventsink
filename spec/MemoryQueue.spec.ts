import MemoryQueue from '../lib/MemoryQueue';
import winston from 'winston';

describe('MemoryQueue', () => {
  let logger: winston.Logger;
  let memoryQueue: MemoryQueue;

  beforeEach(() => {
    logger = winston.createLogger({
      level: 'error',
      silent: true
    });
  });

  afterEach(() => {
    if (memoryQueue) {
      memoryQueue.destroy();
    }
    delete process.env.DISABLE_MEMORY_QUEUE;
  });

  it('should enqueue events successfully', () => {
    memoryQueue = new MemoryQueue(logger, {
      maxSize: 100,
      drainInterval: 10000
    });

    const event = { type: 'test', data: 'test-data' };
    const result = memoryQueue.enqueue(event);

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
    expect(memoryQueue.size()).toBe(1);
  });

  it('should handle overflow by dropping oldest events', () => {
    memoryQueue = new MemoryQueue(logger, {
      maxSize: 2,
      onOverflow: 'drop-oldest',
      drainInterval: 10000
    });

    let droppedEvent: any = null;
    memoryQueue.on('eventDropped', (event) => {
      droppedEvent = event;
    });

    const event1 = { type: 'test', data: '1' };
    const event2 = { type: 'test', data: '2' };
    const event3 = { type: 'test', data: '3' };

    memoryQueue.enqueue(event1);
    memoryQueue.enqueue(event2);
    memoryQueue.enqueue(event3);

    expect(memoryQueue.size()).toBe(2);
    expect(droppedEvent).toBeDefined();
    expect(droppedEvent.event).toEqual(event1);
  });

  it('should process events through drain mechanism', (done) => {
    memoryQueue = new MemoryQueue(logger, {
      maxSize: 100,
      batchSize: 1,
      drainInterval: 10
    });

    let processedEvent: any = null;
    memoryQueue.on('drainEvent', (queuedEvent) => {
      processedEvent = queuedEvent;
      expect(queuedEvent.event).toEqual({ type: 'test', data: 'drain-test' });
      expect(queuedEvent.id).toBeDefined();
      expect(queuedEvent.timestamp).toBeDefined();
      expect(queuedEvent.retryCount).toBe(0);
      done();
    });

    const event = { type: 'test', data: 'drain-test' };
    memoryQueue.enqueue(event);
  });

  it('should retry failed events up to maxRetries', (done) => {
    memoryQueue = new MemoryQueue(logger, {
      maxSize: 100,
      batchSize: 1,
      drainInterval: 10,
      maxRetries: 2
    });

    let attemptCount = 0;
    let failedEvent: any = null;

    memoryQueue.on('drainEvent', () => {
      attemptCount++;
      throw new Error('Simulated processing failure');
    });

    memoryQueue.on('eventFailed', (event) => {
      failedEvent = event;
      expect(attemptCount).toBe(3);
      expect(event.retryCount).toBe(3);
      done();
    });

    const event = { type: 'test', data: 'retry-test' };
    memoryQueue.enqueue(event);
  });

  it('should provide accurate stats', () => {
    memoryQueue = new MemoryQueue(logger, {
      maxSize: 100,
      drainInterval: 10000
    });

    const event1 = { type: 'test', data: '1' };
    const event2 = { type: 'test', data: '2' };

    memoryQueue.enqueue(event1);
    memoryQueue.enqueue(event2);

    const stats = memoryQueue.getStats();
    expect(stats.queueSize).toBe(2);
    expect(stats.maxSize).toBe(100);
    expect(stats.isProcessing).toBe(false);
    expect(stats.oldestEventAge).toBeGreaterThanOrEqual(0);
  });

  it('should flush all events', async () => {
    memoryQueue = new MemoryQueue(logger, {
      maxSize: 100,
      batchSize: 2,
      drainInterval: 10000
    });

    let processedCount = 0;
    memoryQueue.on('drainEvent', () => {
      processedCount++;
    });

    memoryQueue.enqueue({ type: 'test', data: '1' });
    memoryQueue.enqueue({ type: 'test', data: '2' });
    memoryQueue.enqueue({ type: 'test', data: '3' });

    expect(memoryQueue.size()).toBe(3);

    await memoryQueue.flush();

    expect(memoryQueue.size()).toBe(0);
    expect(processedCount).toBe(3);
  });
});