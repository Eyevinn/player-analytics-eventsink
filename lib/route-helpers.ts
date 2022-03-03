import { v4 as uuidv4 } from 'uuid';
import { initResponseBody, responseBody } from '../types/interfaces';

//const { version } = require("../node_modules/@eyevinn/player-analytics-specification/package.json");
const version = "0.3";

const epasVersion = version;
export const responseHeaders = {
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
