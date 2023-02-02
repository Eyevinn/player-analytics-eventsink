import { v4 as uuidv4 } from 'uuid';
import { initResponseBody, responseBody } from '../types/interfaces';

import packageJson from "@eyevinn/player-analytics-specification/package.json";

const epasVersion = packageJson.version;

const defaultResponseHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Origin, X-EPAS-Event, X-EPAS-Version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'X-EPAS-Version': epasVersion || "n/a",
};

export function generateResponseStatus({ path, method }: { path: string; method: string }): { statusCode: number; statusDescription: string } {
  const statusCode = path !== '/' ? 404 : method !== 'POST' ? 405 : 400;
  const statusDescription = path !== '/' ? 'Not Found' : method !== 'POST' ? 'Method Not Allowed' : 'Bad Request';
  return { statusCode, statusDescription };
}

/**
 * Method that returns a valid response
 * @param optional event object
 */
export function generateValidResponseBody(event: Record<string, any>, queueResponse?: any): responseBody {
  let body: responseBody = {
    sessionId: event.sessionId,
    valid: true,
    queueResponse: queueResponse,
  };
  return body;
}

/**
 * Method that returns an invalid response
 * @param optional event object
 */
 export function generateInvalidResponseBody(event?: Record<string, any>): responseBody {
  return {
    sessionId: event?.sessionId || -1,
    message: 'Invalid player event',
    valid: false,
  }
}

export function generateInitResponseBody(event: Record<string, any>): initResponseBody {
  return {
    sessionId: event.sessionId || uuidv4(),
    heartbeatInterval: event.heartbeatInterval || process.env.HEARTBEAT_INTERVAL || 5000,
  };
}

function shouldValidateOrigin(): boolean {
  return (process.env.CORS_ORIGIN !== undefined);
}

function getAllowedOrigins(): string[] {
  if (process.env.CORS_ORIGIN !== undefined) {
    return process.env.CORS_ORIGIN.split(",").map(o => o.trim());
  }
  return [];
}

function isAllowedOrigin(origin: string):  boolean {
  if (shouldValidateOrigin()) {
    const allowedOrigins = getAllowedOrigins();
    return allowedOrigins.includes(origin);
  }
  return true;
}

export function generateResponseHeaders(origin: string) {
  let responseHeaders = defaultResponseHeaders;

  if (shouldValidateOrigin()) {
    if (isAllowedOrigin(origin)) {
      responseHeaders['Access-Control-Allow-Origin'] = origin;
      responseHeaders['Vary'] = 'Origin';
    }
  }
}