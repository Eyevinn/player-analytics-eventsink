// Test memory queue integration with enabled by default behavior
import Sender from '../lib/Sender';
import winston from 'winston';

describe('Memory Queue Integration', () => {
  let logger: winston.Logger;
  let sender: Sender;
  const originalEnv = process.env.DISABLE_MEMORY_QUEUE;

  beforeEach(() => {
    logger = winston.createLogger({
      level: 'error',
      silent: true
    });
    
    // Clear any existing environment variable to test default behavior
    delete process.env.DISABLE_MEMORY_QUEUE;
    process.env.QUEUE_TYPE = 'SQS';
    process.env.AWS_REGION = 'us-east-1';
    process.env.SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/test-queue';
  });

  afterEach(() => {
    if (sender) {
      sender.destroy();
    }
    
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.DISABLE_MEMORY_QUEUE = originalEnv;
    } else {
      delete process.env.DISABLE_MEMORY_QUEUE;
    }
    
    delete process.env.QUEUE_TYPE;
    delete process.env.AWS_REGION;
    delete process.env.SQS_QUEUE_URL;
  });

  it('should enable memory queue by default', async () => {
    sender = new Sender(logger);
    
    const event = { type: 'test', sessionId: 'test-session' };
    const response = await sender.send(event);

    // Memory queue enabled by default should return immediate response
    expect(response).toEqual(jasmine.objectContaining({
      message: 'Event queued for processing',
      memoryQueueId: jasmine.any(String),
      queueSize: jasmine.any(Number)
    }));

    const stats = sender.getMemoryQueueStats();
    expect(stats).not.toBeNull();
    expect(stats!.queueSize).toBeGreaterThan(0);
  });

  it('should disable memory queue when DISABLE_MEMORY_QUEUE=true', async () => {
    process.env.DISABLE_MEMORY_QUEUE = 'true';
    sender = new Sender(logger);
    
    const event = { type: 'test', sessionId: 'test-session' };
    
    try {
      const response = await sender.send(event);
      // When disabled, should attempt direct queue operation (which will fail in test due to missing config)
      expect(response).toEqual(jasmine.objectContaining({
        message: jasmine.any(String)
      }));
      
      // Should not contain memory queue specific fields
      expect(response).not.toEqual(jasmine.objectContaining({
        memoryQueueId: jasmine.any(String)
      }));
    } catch (error) {
      // Direct queue operation may fail in test environment, which is expected
    }

    const stats = sender.getMemoryQueueStats();
    expect(stats).toBeNull();
  });

  it('should provide health stats when enabled', () => {
    sender = new Sender(logger);
    
    const stats = sender.getMemoryQueueStats();
    expect(stats).toEqual(jasmine.objectContaining({
      queueSize: jasmine.any(Number),
      maxSize: jasmine.any(Number),
      isProcessing: jasmine.any(Boolean),
      oldestEventAge: jasmine.any(Number)
    }));
  });

  it('should flush memory queue on demand', async () => {
    sender = new Sender(logger);
    
    // Add an event
    await sender.send({ type: 'test', sessionId: 'test-session' });
    
    const statsBefore = sender.getMemoryQueueStats();
    expect(statsBefore!.queueSize).toBeGreaterThan(0);
    
    // Flush should work without error (even if drain operations fail in test environment)
    await expectAsync(sender.flushMemoryQueue()).not.toBeRejected();
  });

  it('should handle memory queue configuration via environment variables', () => {
    process.env.MEMORY_QUEUE_MAX_SIZE = '500';
    process.env.MEMORY_QUEUE_BATCH_SIZE = '25';
    process.env.MEMORY_QUEUE_DRAIN_INTERVAL = '2000';
    
    sender = new Sender(logger);
    
    const stats = sender.getMemoryQueueStats();
    expect(stats!.maxSize).toBe(500);
    
    // Clean up custom env vars
    delete process.env.MEMORY_QUEUE_MAX_SIZE;
    delete process.env.MEMORY_QUEUE_BATCH_SIZE;
    delete process.env.MEMORY_QUEUE_DRAIN_INTERVAL;
  });
});