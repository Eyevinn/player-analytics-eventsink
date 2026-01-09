import { Validator } from '../lib/Validator';
import { generateInitResponseBody, generateInvalidResponseBody, generateResponseHeaders, generateResponseStatus, generateValidResponseBody, withTimeout, getTimeoutMs } from "../lib/route-helpers";
import Sender from '../lib/Sender';
import Logger from '../logging/logger';
import { initResponseBody, responseBody } from '../types/interfaces';

export const fastify = require('fastify')()
const validator = new Validator(Logger);
const sender = new Sender(Logger);

fastify.options('/', (request, reply) => {
  reply
    .status(200)
    .headers(generateResponseHeaders(request.headers.origin))
    .send({ status: "ok" });
});

fastify.get('/health', (request, reply) => {
  const memoryQueueStats = sender.getMemoryQueueStats();
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    memoryQueue: memoryQueueStats ? {
      enabled: true,
      ...memoryQueueStats
    } : {
      enabled: false
    }
  };
  
  reply
    .status(200)
    .headers({ 'Content-Type': 'application/json' })
    .send(health);
});

fastify.post('/', async (request, reply) => {
  const body = request.body instanceof Object
    ? request.body
    : JSON.parse(request.body);
  const validatorTs = Date.now();
  const validEvent = validator.validateEvent(body);
  Logger.debug(`Time taken to validate event-> ${Date.now() - validatorTs}ms`);
  
  if (validEvent) {
    const senderTs = Date.now();
    try {
      const useMemoryQueue = process.env.DISABLE_MEMORY_QUEUE !== 'true';
      
      if (useMemoryQueue) {
        const resp = await sender.send(body);
        Logger.debug(`Time taken to queue event in memory-> ${Date.now() - senderTs}ms`);
        const responseBody: initResponseBody | responseBody =
          body.event === 'init'
          ? generateInitResponseBody(body)
          : generateValidResponseBody(body, resp);
        
        reply
          .status(200)
          .headers(generateResponseHeaders(request.headers.origin))
          .send(responseBody);
      } else {
        const resp = await withTimeout(sender.send(body), getTimeoutMs());
        Logger.debug(`Time taken to send event to Queue-> ${Date.now() - senderTs}ms`);
        const responseBody: initResponseBody | responseBody =
          body.event === 'init'
          ? generateInitResponseBody(body)
          : generateValidResponseBody(body, resp);
        
        reply
          .status(200)
          .headers(generateResponseHeaders(request.headers.origin))
          .send(responseBody);
      }
    } catch (error) {
      Logger.error('Sender timeout or error:', error);
      reply
        .status(502)
        .headers(generateResponseHeaders(request.headers.origin))
        .send({
          sessionId: body.sessionId || -1,
          message: error.message === 'Operation timed out' ? 'Request timeout' : 'Queue service unavailable',
          valid: false,
        });
    }
  } else {
    reply
      .status(400)
      .headers(generateResponseHeaders(request.headers.origin))
      .send(generateInvalidResponseBody(body));
  }
});

fastify.route({
  method: ['GET', 'POST', 'OPTIONS', 'PATCH', 'PUT', 'DELETE'],
  url: '/*',
  handler: (request, reply) => {
    const { statusCode, statusDescription } = generateResponseStatus({ path: request.url, method: request.method });
    reply.status(statusCode).headers(generateResponseHeaders(request.headers.origin)).send(statusDescription);
  },
});

const gracefulShutdown = async (signal: string) => {
  Logger.info(`Received ${signal}. Graceful shutdown starting...`);
  
  try {
    Logger.info('Flushing memory queue before shutdown...');
    await sender.flushMemoryQueue();
    Logger.info('Memory queue flushed successfully');
    
    Logger.info('Closing Fastify server...');
    await fastify.close();
    Logger.info('Fastify server closed');
    
    Logger.info('Destroying sender resources...');
    sender.destroy();
    Logger.info('Sender resources destroyed');
    
    Logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    Logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT ? Number(process.env.PORT) : 3000, host: '0.0.0.0' });
    Logger.info(`Server started on ${fastify.server.address().address}:${fastify.server.address().port}`);
    
    if (process.env.DISABLE_MEMORY_QUEUE === 'true') {
      Logger.info('Memory queue disabled, using direct queue operations');
    } else {
      Logger.info('Memory queue enabled for immediate response to clients');
    }
  } catch (err) {
    Logger.error("Error starting server", err);
    process.exit(1);
  }
}
start();
