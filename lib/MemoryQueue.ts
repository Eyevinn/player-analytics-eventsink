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
}

export default class MemoryQueue extends EventEmitter {
  private queue: QueuedEvent[] = [];
  private logger: winston.Logger;
  private options: Required<MemoryQueueOptions>;
  private drainTimer?: NodeJS.Timeout;
  private isProcessing = false;
  private nextId = 1;

  constructor(logger: winston.Logger, options: MemoryQueueOptions = {}) {
    super();
    this.logger = logger;
    this.options = {
      maxSize: options.maxSize ?? 10000,
      batchSize: options.batchSize ?? 100,
      drainInterval: options.drainInterval ?? 1000,
      maxRetries: options.maxRetries ?? 3,
      onOverflow: options.onOverflow ?? 'drop-oldest'
    };
    
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

    this.isProcessing = true;
    const batchSize = Math.min(this.options.batchSize, this.queue.length);
    const batch = this.queue.splice(0, batchSize);

    this.logger.debug(`Processing batch of ${batch.length} events, ${this.queue.length} remaining in queue`);

    try {
      await this.processBatchEvents(batch);
    } catch (error) {
      this.logger.error('Error processing batch:', error);
      this.handleBatchFailure(batch);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processBatchEvents(batch: QueuedEvent[]): Promise<void> {
    for (const queuedEvent of batch) {
      try {
        await this.emit('drainEvent', queuedEvent);
      } catch (error) {
        this.logger.error(`Failed to drain event ${queuedEvent.id}:`, error);
        this.handleEventFailure(queuedEvent);
      }
    }
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
    return {
      queueSize: this.queue.length,
      maxSize: this.options.maxSize,
      isProcessing: this.isProcessing,
      oldestEventAge: this.queue.length > 0 ? Date.now() - this.queue[0].timestamp : 0
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