import winston from "winston";

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
  statusCode: number;
  statusDescription: string;
  headers: Record<string, any>;
  body: responseBody;
};

export interface EventValidator {
  logger: winston.Logger;
  eventSchema: any;
  validateEvent(event: Object): boolean;
}

// CMCDv2 response interfaces
export interface CMCDv2EventResult {
  event: string;
  success: boolean;
  error?: string;
}

export interface CMCDv2ResponseBody {
  sessionId: string;
  eventsProcessed: number;
  totalEvents: number;
  results: CMCDv2EventResult[];
  warnings?: string[];
}

export interface CMCDv2ErrorResponse {
  error: string;
  details?: string[];
}
