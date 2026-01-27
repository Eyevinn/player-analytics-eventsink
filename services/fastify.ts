import { Validator } from "../lib/Validator";
import {
  generateInitResponseBody,
  generateInvalidResponseBody,
  generateResponseHeaders,
  generateResponseStatus,
  generateValidResponseBody,
  withTimeout,
  getTimeoutMs,
  generateCMCDv2ResponseBody,
  generateCMCDv2ErrorBody,
} from "../lib/route-helpers";
import Sender from "../lib/Sender";
import Logger from "../logging/logger";
import {
  initResponseBody,
  responseBody,
  CMCDv2EventResult,
} from "../types/interfaces";
import { CMCDv2Parser } from "../lib/CMCDv2Parser";
import { CMCDv2Converter, EPASEvent } from "../lib/CMCDv2Converter";
import { CMCDv2RequestBody } from "../types/cmcdv2";

export const fastify = require("fastify")();
const validator = new Validator(Logger);
const sender = new Sender(Logger);
const cmcdParser = new CMCDv2Parser(Logger);
const cmcdConverter = new CMCDv2Converter(Logger);

fastify.options("/", (request, reply) => {
  reply
    .status(200)
    .headers(generateResponseHeaders(request.headers.origin))
    .send({ status: "ok" });
});

fastify.get("/health", (request, reply) => {
  const memoryQueueStats = sender.getMemoryQueueStats();
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    memoryQueue: memoryQueueStats
      ? {
          enabled: true,
          ...memoryQueueStats,
        }
      : {
          enabled: false,
        },
  };

  reply
    .status(200)
    .headers({ "Content-Type": "application/json" })
    .send(health);
});

fastify.post("/", async (request, reply) => {
  const body =
    request.body instanceof Object ? request.body : JSON.parse(request.body);
  const validatorTs = Date.now();
  const validEvent = validator.validateEvent(body);
  Logger.debug(`Time taken to validate event-> ${Date.now() - validatorTs}ms`);

  if (validEvent) {
    const senderTs = Date.now();
    try {
      const useMemoryQueue = process.env.DISABLE_MEMORY_QUEUE !== "true";

      if (useMemoryQueue) {
        const resp = await sender.send(body);
        Logger.debug(
          `Time taken to queue event in memory-> ${Date.now() - senderTs}ms`,
        );
        const responseBody: initResponseBody | responseBody =
          body.event === "init"
            ? generateInitResponseBody(body)
            : generateValidResponseBody(body, resp);

        reply
          .status(200)
          .headers(generateResponseHeaders(request.headers.origin))
          .send(responseBody);
      } else {
        const resp = await withTimeout(sender.send(body), getTimeoutMs());
        Logger.debug(
          `Time taken to send event to Queue-> ${Date.now() - senderTs}ms`,
        );
        const responseBody: initResponseBody | responseBody =
          body.event === "init"
            ? generateInitResponseBody(body)
            : generateValidResponseBody(body, resp);

        reply
          .status(200)
          .headers(generateResponseHeaders(request.headers.origin))
          .send(responseBody);
      }
    } catch (error) {
      Logger.error("Sender timeout or error:", error);
      reply
        .status(502)
        .headers(generateResponseHeaders(request.headers.origin))
        .send({
          sessionId: body.sessionId || -1,
          message:
            error.message === "Operation timed out"
              ? "Request timeout"
              : "Queue service unavailable",
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

// CMCDv2 endpoint
fastify.options("/cmcd", (request, reply) => {
  reply
    .status(200)
    .headers(generateResponseHeaders(request.headers.origin))
    .send({ status: "ok" });
});

fastify.post("/cmcd", async (request, reply) => {
  try {
    // Parse body
    const body: CMCDv2RequestBody =
      request.body instanceof Object
        ? request.body
        : JSON.parse(request.body || "{}");

    // Parse CMCDv2 data from body and headers
    const parsed = cmcdParser.parse(
      body,
      request.headers as Record<string, string>,
    );

    // Validate parsed data
    const validation = cmcdParser.validate(parsed);
    if (!validation.valid) {
      reply
        .status(400)
        .headers(generateResponseHeaders(request.headers.origin))
        .send(
          generateCMCDv2ErrorBody("Invalid CMCDv2 data", validation.errors),
        );
      return;
    }

    // Check if we have any events to process
    if (parsed.events.length === 0) {
      reply
        .status(400)
        .headers(generateResponseHeaders(request.headers.origin))
        .send(generateCMCDv2ErrorBody("No CMCDv2 events to process"));
      return;
    }

    // Convert CMCDv2 to EPAS events
    const epasEvents = cmcdConverter.convert(parsed.events, parsed.session);

    if (epasEvents.length === 0) {
      reply
        .status(400)
        .headers(generateResponseHeaders(request.headers.origin))
        .send(
          generateCMCDv2ErrorBody("No EPAS events generated from CMCDv2 data"),
        );
      return;
    }

    // Get session ID from first event
    const sessionId = epasEvents[0].sessionId;

    // Validate and queue each EPAS event
    const results: CMCDv2EventResult[] = [];
    const warnings: string[] = [];
    const useMemoryQueue = process.env.DISABLE_MEMORY_QUEUE !== "true";

    for (const epasEvent of epasEvents) {
      const validEvent = validator.validateEvent(epasEvent);

      if (validEvent) {
        try {
          if (useMemoryQueue) {
            await sender.send(epasEvent);
          } else {
            await withTimeout(sender.send(epasEvent), getTimeoutMs());
          }
          results.push({ event: epasEvent.event, success: true });
        } catch (error) {
          Logger.error(`Failed to queue EPAS event ${epasEvent.event}:`, error);
          results.push({
            event: epasEvent.event,
            success: false,
            error: error.message || "Failed to queue event",
          });
        }
      } else {
        Logger.debug(
          `Invalid EPAS event generated from CMCDv2: ${JSON.stringify(epasEvent)}`,
        );
        results.push({
          event: epasEvent.event,
          success: false,
          error: "Generated EPAS event failed validation",
        });
        warnings.push(`Event '${epasEvent.event}' failed EPAS validation`);
      }
    }

    // Determine response status based on results
    const allSucceeded = results.every((r) => r.success);
    const someSucceeded = results.some((r) => r.success);
    const statusCode = allSucceeded ? 200 : someSucceeded ? 207 : 400;

    reply
      .status(statusCode)
      .headers(generateResponseHeaders(request.headers.origin))
      .send(
        generateCMCDv2ResponseBody(
          sessionId,
          results,
          warnings.length > 0 ? warnings : undefined,
        ),
      );
  } catch (error) {
    Logger.error("CMCDv2 endpoint error:", error);
    reply
      .status(500)
      .headers(generateResponseHeaders(request.headers.origin))
      .send(generateCMCDv2ErrorBody("Internal server error", [error.message]));
  }
});

fastify.route({
  method: ["GET", "POST", "OPTIONS", "PATCH", "PUT", "DELETE"],
  url: "/*",
  handler: (request, reply) => {
    const { statusCode, statusDescription } = generateResponseStatus({
      path: request.url,
      method: request.method,
    });
    reply
      .status(statusCode)
      .headers(generateResponseHeaders(request.headers.origin))
      .send(statusDescription);
  },
});

const gracefulShutdown = async (signal: string) => {
  Logger.info(`Received ${signal}. Graceful shutdown starting...`);

  try {
    Logger.info("Flushing memory queue before shutdown...");
    await sender.flushMemoryQueue();
    Logger.info("Memory queue flushed successfully");

    Logger.info("Closing Fastify server...");
    await fastify.close();
    Logger.info("Fastify server closed");

    Logger.info("Destroying sender resources...");
    sender.destroy();
    Logger.info("Sender resources destroyed");

    Logger.info("Destroying CMCDv2 converter resources...");
    cmcdConverter.destroy();
    Logger.info("CMCDv2 converter resources destroyed");

    Logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    Logger.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

const start = async () => {
  try {
    await fastify.listen({
      port: process.env.PORT ? Number(process.env.PORT) : 3000,
      host: "0.0.0.0",
    });
    Logger.info(
      `Server started on ${fastify.server.address().address}:${fastify.server.address().port}`,
    );

    if (process.env.DISABLE_MEMORY_QUEUE === "true") {
      Logger.info("Memory queue disabled, using direct queue operations");
    } else {
      Logger.info("Memory queue enabled for immediate response to clients");
    }
  } catch (err) {
    Logger.error("Error starting server", err);
    process.exit(1);
  }
};
start();
