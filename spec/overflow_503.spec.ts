import Sender, { QueueFullError } from '../lib/Sender';
import { fastify } from '../services/fastify';
import winston from 'winston';

const silentLogger = () =>
  winston.createLogger({ level: 'error', silent: true });

describe('memory queue overflow -> reject (no silent drop)', () => {
  describe('Sender.send', () => {
    let sender: Sender;
    const saved = {
      disable: process.env.DISABLE_MEMORY_QUEUE,
      maxSize: process.env.MEMORY_QUEUE_MAX_SIZE,
      drain: process.env.MEMORY_QUEUE_DRAIN_INTERVAL,
    };

    beforeEach(() => {
      delete process.env.DISABLE_MEMORY_QUEUE;
      // Tiny queue + an effectively-never drain so the queue stays full for the
      // duration of the synchronous enqueues in this test.
      process.env.MEMORY_QUEUE_MAX_SIZE = '2';
      process.env.MEMORY_QUEUE_DRAIN_INTERVAL = '1000000';
    });

    afterEach(() => {
      if (sender) {
        sender.destroy();
      }
      const restore = (key: string, value?: string) =>
        value === undefined
          ? delete process.env[key]
          : (process.env[key] = value);
      restore('DISABLE_MEMORY_QUEUE', saved.disable);
      restore('MEMORY_QUEUE_MAX_SIZE', saved.maxSize);
      restore('MEMORY_QUEUE_DRAIN_INTERVAL', saved.drain);
    });

    it('rejects with QueueFullError when full and never drops an accepted event', async () => {
      sender = new Sender(silentLogger());

      const ok1 = await sender.send({ event: 'heartbeat', sessionId: 's', data: '1' });
      const ok2 = await sender.send({ event: 'heartbeat', sessionId: 's', data: '2' });
      expect(ok1).toEqual(jasmine.objectContaining({ message: 'Event queued for processing' }));
      expect(ok2).toEqual(jasmine.objectContaining({ message: 'Event queued for processing' }));

      // The queue is now full: the next send must be rejected, not silently
      // accepted and not silently dropped.
      await expectAsync(
        sender.send({ event: 'heartbeat', sessionId: 's', data: '3' }),
      ).toBeRejectedWithError(QueueFullError);

      const stats = sender.getMemoryQueueStats();
      expect(stats!.queueSize).toBe(2); // the two accepted events are still queued
      expect(stats!.droppedCount).toBe(0); // nothing accepted was dropped
    });
  });

  describe('POST / (HTTP layer)', () => {
    it('returns 503 (not 200) when the memory queue rejects on overflow', async () => {
      // Force the route's sender.send to behave as if the queue is full. This
      // proves the route maps a QueueFullError to 503 for a valid event.
      spyOn(Sender.prototype, 'send').and.callFake(() =>
        Promise.reject(new QueueFullError('Memory queue is full')),
      );

      const response = await fastify.inject({
        method: 'POST',
        url: '/',
        headers: { 'content-type': 'application/json' },
        payload: {
          event: 'heartbeat',
          sessionId: '123-214-234',
          timestamp: 0,
          playhead: 0,
          duration: 0,
        },
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(false);
      expect(body.message).toContain('retry');
    });
  });
});
