import winston from 'winston';

export interface initResponseBody {
  sessionId: string;
  heartbeatInterval: number;
}

export interface responseBody {
  sessionId: string;
  valid: boolean;
  message?: string;
  queueResponse?: any;
}

export type validatorResponse = {
  statusCode: number,
  statusDescription: string,
  headers: Record<string, any>,
  body: responseBody,
}

export interface EventValidator {
  logger: winston.Logger;
  eventSchema: any;
  validateEvent(event: Object): boolean;
}
