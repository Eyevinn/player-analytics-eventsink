import { v4 as uuidv4 } from "uuid";
import {
  initResponseBody,
  responseBody,
  ValidationError,
  CMCDv2ResponseBody,
  CMCDv2EventResult,
  CMCDv2ErrorResponse,
} from "../types/interfaces";

import packageJson from "@eyevinn/player-analytics-specification/package.json";

const epasVersion = packageJson.version;

const responseHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Headers":
    "Content-Type, Origin, X-EPAS-Event, X-EPAS-Version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "X-EPAS-Version": epasVersion || "n/a",
};

export function generateResponseHeaders(origin?: string) {
  if (process.env.CORS_ALLOWED_ORIGINS && origin) {
    const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS.split(",").map(
      (o) => o.trim(),
    );
    if (allowedOrigins.includes(origin)) {
      return {
        ...responseHeaders,
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
      };
    } else {
      return {
        ...responseHeaders,
        Vary: "Origin",
      };
    }
  }
  return {
    "Access-Control-Allow-Origin": "*",
    ...responseHeaders,
  };
}

/**
 * Derive the EPAS `domain` field from a request's HTTP `Origin` header.
 *
 * Per the EPAS specification (player-analytics-specification 0.6.0, server-
 * populated fields), `domain` is the scheme + host + optional port of the page
 * that produced the event — i.e. the value of the `Origin` header itself
 * (e.g. "https://example.com"). It is server-derived and MUST NOT be trusted as
 * a client-supplied value. When the `Origin` header is absent (or is not a
 * parseable origin), the field is omitted entirely — never set to an empty
 * string or a placeholder.
 *
 * We normalise the header through the URL parser and return `URL.origin`, which
 * yields exactly the scheme + host + optional port. Any value that does not
 * parse to a concrete origin (missing, empty, or malformed) yields `undefined`
 * so the caller omits the field.
 *
 * @param origin the raw `Origin` request header, if present
 * @returns the derived domain string, or `undefined` when it must be omitted
 */
export function deriveDomainFromOrigin(origin?: string): string | undefined {
  if (!origin) {
    return undefined;
  }
  try {
    const { origin: parsedOrigin } = new URL(origin);
    // Opaque origins (e.g. "null", non-hierarchical schemes) serialise to
    // "null" — treat those as absent rather than forwarding a placeholder.
    if (!parsedOrigin || parsedOrigin === "null") {
      return undefined;
    }
    return parsedOrigin;
  } catch {
    return undefined;
  }
}

/**
 * Attach the server-derived `domain` to an event in place, when it can be
 * derived from the request's `Origin` header. When the header is absent or
 * unparseable the event is left untouched so `domain` stays omitted.
 *
 * @param event the event object forwarded to the queue
 * @param origin the raw `Origin` request header, if present
 */
export function attachDomainFromOrigin(
  event: Record<string, any>,
  origin?: string,
): void {
  const domain = deriveDomainFromOrigin(origin);
  if (domain !== undefined) {
    event.domain = domain;
  }
}

export function generateResponseStatus({
  path,
  method,
}: {
  path: string;
  method: string;
}): { statusCode: number; statusDescription: string } {
  const statusCode = path !== "/" ? 404 : method !== "POST" ? 405 : 400;
  const statusDescription =
    path !== "/"
      ? "Not Found"
      : method !== "POST"
        ? "Method Not Allowed"
        : "Bad Request";
  return { statusCode, statusDescription };
}

/**
 * Method that returns a valid response
 * @param optional event object
 */
export function generateValidResponseBody(
  event: Record<string, any>,
  queueResponse?: any,
): responseBody {
  const body: responseBody = {
    sessionId: event.sessionId,
    valid: true,
    queueResponse: queueResponse,
  };
  return body;
}

/**
 * Build the JSON body for a 400 Invalid Player Event response.
 *
 * @param event optional event object — used to echo back `sessionId` when present
 * @param errors optional array of validation errors — included in the response
 *   body only when non-empty, so a caller-agnostic "invalid" 400 (no schema
 *   errors known, e.g. from a 404/405 wildcard route) omits the field
 */
export function generateInvalidResponseBody(
  event?: Record<string, any>,
  errors?: ValidationError[],
): responseBody {
  const body: responseBody = {
    sessionId: event?.sessionId || -1,
    message: "Invalid player event",
    valid: false,
  };
  if (errors && errors.length > 0) {
    body.errors = errors;
  }
  return body;
}

export function generateInitResponseBody(
  event: Record<string, any>,
): initResponseBody {
  return {
    sessionId: event.sessionId || uuidv4(),
    heartbeatInterval:
      event.heartbeatInterval || process.env.HEARTBEAT_INTERVAL || 5000,
  };
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Operation timed out"));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export function getTimeoutMs(): number {
  const envTimeout = process.env.SEND_TIMEOUT_MS;
  return envTimeout ? parseInt(envTimeout, 10) : 3000;
}

/**
 * Generate a CMCDv2 success response body
 */
export function generateCMCDv2ResponseBody(
  sessionId: string,
  results: CMCDv2EventResult[],
  warnings?: string[],
): CMCDv2ResponseBody {
  const eventsProcessed = results.filter((r) => r.success).length;
  const response: CMCDv2ResponseBody = {
    sessionId,
    eventsProcessed,
    totalEvents: results.length,
    results,
  };

  if (warnings && warnings.length > 0) {
    response.warnings = warnings;
  }

  return response;
}

/**
 * Generate a CMCDv2 error response body
 */
export function generateCMCDv2ErrorBody(
  error: string,
  details?: string[],
): CMCDv2ErrorResponse {
  const response: CMCDv2ErrorResponse = { error };
  if (details && details.length > 0) {
    response.details = details;
  }
  return response;
}
