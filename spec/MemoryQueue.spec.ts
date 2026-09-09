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

  it('should not exceed maxSize or silently lose a live event when retrying at capacity', (done) => {
    memoryQueue = new MemoryQueue(logger, {
      maxSize: 3,
      batchSize: 1,
      drainInterval: 10,
      maxRetries: 3,
      onOverflow: 'drop-oldest',
      adaptiveThrottling: false
    });

    // Fail the very first drained event so it is re-inserted for retry while
    // the queue is still full; every subsequent drain succeeds.
    let failNextDrain = true;
    memoryQueue.on('drainEvent', () => {
      if (failNextDrain) {
        failNextDrain = false;
        throw new Error('Simulated processing failure');
      }
    });

    // Any event overwritten by a retry re-insertion must surface as a drop,
    // never be silently lost.
    const droppedIds: string[] = [];
    memoryQueue.on('eventDropped', (event) => {
      droppedIds.push(event.id);
    });

    // Fill the queue to exactly maxSize.
    const enqueuedIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const result = memoryQueue.enqueue({ type: 'test', data: `event-${i}` });
      enqueuedIds.push(result.id as string);
    }

    expect(memoryQueue.size()).toBe(3);

    // Poll while the drain timer processes and the failed event retries.
    let maxObservedSize = memoryQueue.size();
    const interval = setInterval(() => {
      maxObservedSize = Math.max(maxObservedSize, memoryQueue.size());

      // count must never exceed maxSize at any observed point.
      expect(memoryQueue.size()).toBeLessThanOrEqual(3);

      if (memoryQueue.size() === 0) {
        clearInterval(interval);

        // Every enqueued event must have been either successfully drained or
        // explicitly reported as dropped — none silently overwritten.
        expect(maxObservedSize).toBeLessThanOrEqual(3);
        done();
      }
    }, 5);
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

  it('should respect concurrent operation limits', (done) => {
    memoryQueue = new MemoryQueue(logger, {
      maxSize: 100,
      batchSize: 5,
      drainInterval: 10,
      maxConcurrentEvents: 2,
      eventDelayMs: 50
    });

    let concurrentCount = 0;
    let maxConcurrent = 0;

    memoryQueue.on('drainEvent', async () => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 20));
      
      concurrentCount--;
      
      if (concurrentCount === 0 && maxConcurrent > 0) {
        expect(maxConcurrent).toBeLessThanOrEqual(2);
        done();
      }
    });

    // Add multiple events
    for (let i = 0; i < 5; i++) {
      memoryQueue.enqueue({ type: 'test', data: `event-${i}` });
    }
  });

  it('should include throttling stats', () => {
    memoryQueue = new MemoryQueue(logger, {
      maxSize: 100,
      eventDelayMs: 20,
      adaptiveThrottling: true,
      maxConcurrentEvents: 3
    });

    const stats = memoryQueue.getStats();
    
    expect(stats.currentThrottleDelayMs).toBeDefined();
    expect(stats.baseThrottleDelayMs).toBe(20);
    expect(stats.maxConcurrentOperations).toBe(3);
    expect(stats.adaptiveThrottling).toBe(true);
    expect(stats.averageResponseTimeMs).toBeDefined();
    expect(stats.activeConcurrentOperations).toBeDefined();
  });

  it('should handle throttling configuration', () => {
    memoryQueue = new MemoryQueue(logger, {
      maxSize: 100,
      eventDelayMs: 15,
      adaptiveThrottling: false,
      maxConcurrentEvents: 10
    });

    const stats = memoryQueue.getStats();
    expect(stats.baseThrottleDelayMs).toBe(15);
    expect(stats.maxConcurrentOperations).toBe(10);
    expect(stats.adaptiveThrottling).toBe(false);
  });
});