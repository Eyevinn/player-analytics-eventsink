import winston from "winston";

export interface initResponseBody {
  sessionId: string;
  heartbeatInterval: number;
}

export interface responseBody {
  sessionId: string;
  valid: boolean;
  message?: string;
  errors?: ValidationError[];
  queueResponse?: any;
}

export type validatorResponse = {
  statusCode: number;
  statusDescription: string;
  headers: Record<string, any>;
  body: responseBody;
};

/**
 * A single validation failure reported by the AJV validator.
 * `field` is a JSON Pointer to the offending location in the event
 * (e.g. `/sessionId`), or `/` for a root-level failure.
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Result of validating an event. Discriminated union: when `valid` is
 * `false`, the `errors` array is guaranteed to be non-empty. When
 * `valid` is `true`, no error field is present.
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ValidationError[] };

export interface EventValidator {
  logger: winston.Logger;
  eventSchema: any;
  /**
   * Validate an event against the EPAS schema. Returns a discriminated
   * result rather than throwing on invalid input; construction of the
   * validator itself may throw if the schema pointer cannot be compiled.
   */
  validateEvent(event: Object | undefined | null): ValidationResult;
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
