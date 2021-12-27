import { v4 as uuidv4 } from 'uuid';
import { initResponseBody, responseBody } from '../types/interfaces';

export const responseHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Origin',
};

/**
 * Method that returns a valid response
 * @param optional event object
 */
export function generateValidResponseBody(event: Record<string, any>): responseBody {
  let body: responseBody = {
    sessionId: event.sessionId,
    valid: true
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

export function generatedInitResponseBody(event: Record<string, any>): initResponseBody {
  return {
    sessionId: event.sessionId || uuidv4(),
    heartbeatInterval: event.heartbeatInterval || process.env.HEARTBEAT_INTERVAL || 5000,
  };
}
