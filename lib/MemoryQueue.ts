import winston from 'winston';
import { EventEmitter } from 'events';

interface QueuedEvent {
  id: string;
  event: Object;
  timestamp: number;
  retryCount: number;
}

interface MemoryQueueOptions {
  maxSize?: number;
  batchSize?: number;
  drainInterval?: number;
  maxRetries?: number;
  onOverflow?: 'drop-oldest' | 'drop-newest' | 'reject';
  eventDelayMs?: number;
  adaptiveThrottling?: boolean;
  maxConcurrentEvents?: number;
}

export default class MemoryQueue extends EventEmitter {
  private queue: QueuedEvent[] = [];
  private logger: winston.Logger;
  private options: Required<MemoryQueueOptions>;
  private drainTimer?: NodeJS.Timeout;
  private isProcessing = false;
  private nextId = 1;
  private activeDrainPromises = new Set<Promise<void>>();
  private recentResponseTimes: number[] = [];
  private currentDelayMs = 0;

  constructor(logger: winston.Logger, options: MemoryQueueOptions = {}) {
    super();
    this.logger = logger;
    this.options = {
      maxSize: options.maxSize ?? 20000,
      batchSize: options.batchSize ?? 50,
      drainInterval: options.drainInterval ?? 1000,
      maxRetries: options.maxRetries ?? 3,
      onOverflow: options.onOverflow ?? 'drop-oldest',
      eventDelayMs: options.eventDelayMs ?? 10,
      adaptiveThrottling: options.adaptiveThrottling ?? true,
      maxConcurrentEvents: options.maxConcurrentEvents ?? 5
    };
    
    this.currentDelayMs = this.options.eventDelayMs;
    
    this.startDrainTimer();
  }

  private startDrainTimer(): void {
    this.drainTimer = setInterval(() => {
      this.processBatch();
    }, this.options.drainInterval);
  }

  private stopDrainTimer(): void {
    if (this.drainTimer) {
      clearInterval(this.drainTimer);
      this.drainTimer = undefined;
    }
  }

  enqueue(event: Object): { success: boolean; id?: string; error?: string } {
    if (this.queue.length >= this.options.maxSize) {
      this.handleOverflow();
    }

    const queuedEvent: QueuedEvent = {
      id: `mem_${this.nextId++}`,
      event,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.queue.push(queuedEvent);
    this.logger.debug(`Event queued in memory: ${queuedEvent.id}, queue size: ${this.queue.length}`);
    
    return { success: true, id: queuedEvent.id };
  }

  private handleOverflow(): void {
    switch (this.options.onOverflow) {
      case 'drop-oldest':
        const dropped = this.queue.shift();
        if (dropped) {
          this.logger.warn(`Memory queue overflow: dropped oldest event ${dropped.id}`);
          this.emit('eventDropped', dropped);
        }
        break;
      case 'drop-newest':
        this.logger.warn('Memory queue overflow: rejecting newest event');
        throw new Error('Memory queue is full');
      case 'reject':
        throw new Error('Memory queue is full');
    }
  }

  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    // Check concurrent processing limit
    if (this.activeDrainPromises.size >= this.options.maxConcurrentEvents) {
      this.logger.debug(`Skipping batch processing: ${this.activeDrainPromises.size} concurrent operations active`);
      return;
    }

    this.isProcessing = true;
    const batchSize = Math.min(this.options.batchSize, this.queue.length);
    const batch = this.queue.splice(0, batchSize);

    this.logger.debug(`Processing batch of ${batch.length} events, ${this.queue.length} remaining in queue, current delay: ${this.currentDelayMs}ms`);

    try {
      await this.processBatchEventsWithThrottling(batch);
    } catch (error) {
      this.logger.error('Error processing batch:', error);
      this.handleBatchFailure(batch);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processBatchEventsWithThrottling(batch: QueuedEvent[]): Promise<void> {
    for (let i = 0; i < batch.length; i++) {
      const queuedEvent = batch[i];
      
      // Add delay between events to reduce stress
      if (i > 0 && this.currentDelayMs > 0) {
        await this.delay(this.currentDelayMs);
      }
      
      // Start the drain operation but don't wait for it - fire and forget
      this.drainSingleEventAsync(queuedEvent);
    }
  }

  private drainSingleEventAsync(queuedEvent: QueuedEvent): void {
    const startTime = Date.now();
    
    // Create the drain promise but don't await it in the main flow
    const drainPromise = this.executeDrainEvent(queuedEvent);
    this.activeDrainPromises.add(drainPromise);
    
    // Handle completion asynchronously
    drainPromise
      .then(() => {
        const responseTime = Date.now() - startTime;
        this.recordResponseTime(responseTime);
        this.adjustThrottling(responseTime);
        this.logger.debug(`Successfully drained event ${queuedEvent.id} from memory queue`);
      })
      .catch((error) => {
        this.logger.error(`Failed to drain event ${queuedEvent.id}:`, error);
        this.handleEventFailure(queuedEvent);
        this.adjustThrottlingForError();
      })
      .finally(() => {
        this.activeDrainPromises.delete(drainPromise);
      });
  }

  private async executeDrainEvent(queuedEvent: QueuedEvent): Promise<void> {
    // Create a promise that resolves when the event listener completes
    const listeners = this.listeners('drainEvent');
    if (listeners.length === 0) {
      return Promise.resolve();
    }
    
    // Execute the first listener (should be the Sender's handler)
    const listener = listeners[0] as (queuedEvent: QueuedEvent) => Promise<void>;
    return listener(queuedEvent);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private recordResponseTime(responseTime: number): void {
    this.recentResponseTimes.push(responseTime);
    
    // Keep only recent response times (last 10)
    if (this.recentResponseTimes.length > 10) {
      this.recentResponseTimes.shift();
    }
  }

  private adjustThrottling(responseTime: number): void {
    if (!this.options.adaptiveThrottling) {
      return;
    }

    const avgResponseTime = this.recentResponseTimes.reduce((sum, time) => sum + time, 0) / this.recentResponseTimes.length;
    
    // If response times are high, increase delay
    if (avgResponseTime > 1000) { // 1 second
      this.currentDelayMs = Math.min(this.currentDelayMs + 5, 100); // Max 100ms delay
      this.logger.debug(`Increased throttling delay to ${this.currentDelayMs}ms due to high response time: ${avgResponseTime}ms`);
    } 
    // If response times are good, decrease delay
    else if (avgResponseTime < 200 && this.currentDelayMs > this.options.eventDelayMs) {
      this.currentDelayMs = Math.max(this.currentDelayMs - 2, this.options.eventDelayMs);
      this.logger.debug(`Decreased throttling delay to ${this.currentDelayMs}ms due to good response time: ${avgResponseTime}ms`);
    }
  }

  private adjustThrottlingForError(): void {
    if (!this.options.adaptiveThrottling) {
      return;
    }

    // Increase delay significantly on errors to reduce stress
    this.currentDelayMs = Math.min(this.currentDelayMs + 20, 200); // Max 200ms delay on errors
    this.logger.info(`Increased throttling delay to ${this.currentDelayMs}ms due to error`);
  }

  private handleBatchFailure(batch: QueuedEvent[]): void {
    for (const queuedEvent of batch) {
      this.handleEventFailure(queuedEvent);
    }
  }

  private handleEventFailure(queuedEvent: QueuedEvent): void {
    queuedEvent.retryCount++;
    
    if (queuedEvent.retryCount <= this.options.maxRetries) {
      this.queue.unshift(queuedEvent);
      this.logger.warn(`Event ${queuedEvent.id} failed, retry ${queuedEvent.retryCount}/${this.options.maxRetries}`);
    } else {
      this.logger.error(`Event ${queuedEvent.id} failed permanently after ${this.options.maxRetries} retries`);
      this.emit('eventFailed', queuedEvent);
    }
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  getStats() {
    const avgResponseTime = this.recentResponseTimes.length > 0 
      ? this.recentResponseTimes.reduce((sum, time) => sum + time, 0) / this.recentResponseTimes.length 
      : 0;

    return {
      queueSize: this.queue.length,
      maxSize: this.options.maxSize,
      isProcessing: this.isProcessing,
      oldestEventAge: this.queue.length > 0 ? Date.now() - this.queue[0].timestamp : 0,
      activeConcurrentOperations: this.activeDrainPromises.size,
      maxConcurrentOperations: this.options.maxConcurrentEvents,
      currentThrottleDelayMs: this.currentDelayMs,
      baseThrottleDelayMs: this.options.eventDelayMs,
      averageResponseTimeMs: Math.round(avgResponseTime),
      adaptiveThrottling: this.options.adaptiveThrottling
    };
  }

  async flush(): Promise<void> {
    this.logger.info(`Flushing memory queue with ${this.queue.length} events`);
    
    while (this.queue.length > 0 && !this.isProcessing) {
      await this.processBatch();
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  destroy(): void {
    this.stopDrainTimer();
    this.removeAllListeners();
    this.queue = [];
  }
}
