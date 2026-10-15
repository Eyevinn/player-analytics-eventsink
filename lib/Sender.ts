import winston from "winston";
import MemoryQueue from "./MemoryQueue";

/**
 * Raised by {@link Sender.send} when the in-memory queue is at capacity and the
 * configured overflow strategy refuses the event. The HTTP layer maps this to a
 * 503 so clients (SDKs) can retry — the event is never silently accepted behind
 * a 200 and later dropped.
 */
export class QueueFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueFullError";
  }
}

export default class Sender {
  logger: winston.Logger;
  private static queueAdapterCache: Map<string, any> = new Map();
  private static queueAdapterPromises: Map<string, Promise<any>> = new Map();
  private memoryQueue?: MemoryQueue;
  private useMemoryQueue: boolean;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.useMemoryQueue = process.env.DISABLE_MEMORY_QUEUE !== "true";

    if (this.useMemoryQueue) {
      this.initializeMemoryQueue();
    }
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
      case "SQS":
        QueueAdapter = (await import("@eyevinn/player-analytics-shared"))
          .SqsQueueAdapter;
        const maxSockets = process.env.SQS_MAX_SOCKETS
          ? parseInt(process.env.SQS_MAX_SOCKETS, 10)
          : undefined;
        return new QueueAdapter(this.logger, { maxSockets });
      case "beanstalkd":
        QueueAdapter = (await import("@eyevinn/player-analytics-shared"))
          .BeanstalkdAdapter;
        break;
      case "redis":
        QueueAdapter = (await import("@eyevinn/player-analytics-shared"))
          .RedisAdapter;
        break;
      default:
        throw new Error("No queue type specified");
    }

    return new QueueAdapter(this.logger);
  }

  private initializeMemoryQueue(): void {
    const options = {
      maxSize: process.env.MEMORY_QUEUE_MAX_SIZE
        ? parseInt(process.env.MEMORY_QUEUE_MAX_SIZE, 10)
        : 10000,
      batchSize: process.env.MEMORY_QUEUE_BATCH_SIZE
        ? parseInt(process.env.MEMORY_QUEUE_BATCH_SIZE, 10)
        : 50,
      drainInterval: process.env.MEMORY_QUEUE_DRAIN_INTERVAL
        ? parseInt(process.env.MEMORY_QUEUE_DRAIN_INTERVAL, 10)
        : 100,
      maxRetries: process.env.MEMORY_QUEUE_MAX_RETRIES
        ? parseInt(process.env.MEMORY_QUEUE_MAX_RETRIES, 10)
        : 3,
      onOverflow:
        (process.env.MEMORY_QUEUE_OVERFLOW_STRATEGY as
          | "drop-oldest"
          | "drop-newest"
          | "reject") || "reject",
      eventDelayMs: process.env.MEMORY_QUEUE_EVENT_DELAY_MS
        ? parseInt(process.env.MEMORY_QUEUE_EVENT_DELAY_MS, 10)
        : 0,
      adaptiveThrottling:
        process.env.MEMORY_QUEUE_ADAPTIVE_THROTTLING !== "false",
      maxConcurrentEvents: process.env.MEMORY_QUEUE_MAX_CONCURRENT
        ? parseInt(process.env.MEMORY_QUEUE_MAX_CONCURRENT, 10)
        : 10,
    };

    this.memoryQueue = new MemoryQueue(this.logger, options);

    this.memoryQueue.on("drainEvent", async (queuedEvent) => {
      return this.sendToActualQueue(queuedEvent.event);
    });

    this.memoryQueue.on("eventDropped", (queuedEvent) => {
      this.logger.warn(
        `Event ${queuedEvent.id} was dropped from memory queue due to overflow`,
      );
    });

    this.memoryQueue.on("eventFailed", (queuedEvent) => {
      this.logger.error(
        `Event ${queuedEvent.id} permanently failed after all retries`,
      );
    });

    this.logger.info(
      "Memory queue initialized and background processor started",
    );
  }

  private async sendToActualQueue(event: Object): Promise<Object> {
    const queueType = process.env.QUEUE_TYPE;

    if (!queueType) {
      this.logger.warn("No queue type specified");
      return { message: "No queue type specified" };
    }

    try {
      const queue = await this.getQueueAdapter(queueType);
      const queueTs = Date.now();
      const queueResponse = await queue.pushToQueue(event);
      const timeTaken = Date.now() - queueTs;

      this.logger.debug(
        `Time taken to run "await queue.pushToQueue(event)"-> ${timeTaken}ms`,
      );

      if (timeTaken > 5000) {
        this.logger.warn(
          `Queue operation took ${timeTaken}ms (> 5 seconds) - performance may be degraded`,
        );
      } else if (timeTaken > 2000) {
        this.logger.debug(`Queue operation took ${timeTaken}ms (> 2 seconds)`);
      }

      return queueResponse;
    } catch (error) {
      this.logger.error("Error getting queue adapter:", error);
      return { message: error.message };
    }
  }

  /**
   *
   * @param event the event object to send
   * @returns an object with the response from the event sender or an empty object if there was an error
   */
  async send(event: Object): Promise<Object> {
    if (this.useMemoryQueue && this.memoryQueue) {
      let result: {
        success: boolean;
        id?: string;
        error?: string;
        overflow?: boolean;
      };
      try {
        result = this.memoryQueue.enqueue(event);
      } catch (error) {
        // Unexpected memory-queue failure (not an expected overflow) — fall back
        // to a direct queue send so a transient internal error does not lose data.
        this.logger.error(
          "Memory queue error, falling back to direct send:",
          error,
        );
        return await this.sendToActualQueue(event);
      }

      if (result.success) {
        this.logger.debug(
          `Event ${result.id} added to memory queue, size: ${this.memoryQueue.size()}`,
        );
        return {
          message: "Event queued for processing",
          memoryQueueId: result.id,
          queueSize: this.memoryQueue.size(),
        };
      }

      if (result.overflow) {
        // Queue is at capacity and the overflow strategy refuses the event.
        // Surface this so the HTTP layer returns 503 (clients can retry) instead
        // of silently accepting and later dropping the event behind a 200.
        this.logger.warn(
          `Memory queue full, rejecting event so caller can retry: ${result.error}`,
        );
        throw new QueueFullError(result.error || "Memory queue is full");
      }

      this.logger.error(`Failed to add event to memory queue: ${result.error}`);
      return { message: result.error || "Failed to queue event" };
    } else {
      return await this.sendToActualQueue(event);
    }
  }

  getMemoryQueueStats() {
    return this.memoryQueue?.getStats() || null;
  }

  async flushMemoryQueue(): Promise<void> {
    if (this.memoryQueue) {
      await this.memoryQueue.flush();
    }
  }

  destroy(): void {
    if (this.memoryQueue) {
      this.memoryQueue.destroy();
      this.memoryQueue = undefined;
    }
  }
}
