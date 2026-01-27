import winston from "winston";
import {
  CMCDv2Data,
  CMCDv2Session,
  CMCDv2Object,
  CMCDv2Request,
  CMCDv2Status,
  CMCDv2RequestBody,
  ParsedCMCDv2,
} from "../types/cmcdv2";

export class CMCDv2Parser {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   * Parse CMCDv2 data from request body and headers
   */
  parse(
    body: CMCDv2RequestBody,
    headers: Record<string, string>,
  ): ParsedCMCDv2 {
    const headerData = this.parseHeaders(headers);
    const bodyData = this.parseBody(body);

    // Merge session from headers, body top-level, and first event's session (body takes precedence)
    const firstEventSession =
      bodyData.events.length > 0 ? bodyData.events[0].session : {};
    const session: CMCDv2Session = {
      ...headerData.session,
      ...bodyData.session,
      ...firstEventSession,
    };

    // Merge header data into each event
    const events: CMCDv2Data[] = bodyData.events.map((event) => ({
      session: { ...headerData.session, ...event.session },
      object: { ...headerData.object, ...event.object },
      request: { ...headerData.request, ...event.request },
      status: { ...headerData.status, ...event.status },
      response: event.response,
      event: event.event,
    }));

    // If no events but we have header status with buffer starvation, create a synthetic event
    if (events.length === 0 && headerData.status?.bs === true) {
      events.push({
        session: headerData.session,
        object: headerData.object,
        request: headerData.request,
        status: headerData.status,
      });
    }

    return { session, events };
  }

  /**
   * Parse CMCD headers into data objects
   */
  private parseHeaders(headers: Record<string, string>): Partial<CMCDv2Data> {
    const result: Partial<CMCDv2Data> = {};

    // Normalize header keys to lowercase for case-insensitive lookup
    const normalizedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      normalizedHeaders[key.toLowerCase()] = value;
    }

    const sessionHeader = normalizedHeaders["cmcd-session"];
    const objectHeader = normalizedHeaders["cmcd-object"];
    const requestHeader = normalizedHeaders["cmcd-request"];
    const statusHeader = normalizedHeaders["cmcd-status"];

    if (sessionHeader) {
      result.session = this.parseHeaderValue<CMCDv2Session>(
        sessionHeader,
        "session",
      );
    }

    if (objectHeader) {
      result.object = this.parseHeaderValue<CMCDv2Object>(
        objectHeader,
        "object",
      );
    }

    if (requestHeader) {
      result.request = this.parseHeaderValue<CMCDv2Request>(
        requestHeader,
        "request",
      );
    }

    if (statusHeader) {
      result.status = this.parseHeaderValue<CMCDv2Status>(
        statusHeader,
        "status",
      );
    }

    return result;
  }

  /**
   * Parse a CMCD header value string into an object
   * Format: key1=value1,key2=value2,key3 (boolean true keys have no value)
   */
  private parseHeaderValue<T>(headerValue: string, type: string): T {
    const result: Record<string, any> = {};

    // Split by comma, but handle quoted strings
    const pairs = this.splitHeaderValue(headerValue);

    for (const pair of pairs) {
      const trimmed = pair.trim();
      if (!trimmed) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) {
        // Boolean flag (presence means true)
        result[trimmed] = true;
      } else {
        const key = trimmed.substring(0, eqIndex);
        let value = trimmed.substring(eqIndex + 1);

        // Remove quotes from string values
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
          result[key] = value;
        } else {
          // Try to parse as number
          const numValue = parseFloat(value);
          result[key] = isNaN(numValue) ? value : numValue;
        }
      }
    }

    this.logger.debug(`Parsed CMCD ${type} header: ${JSON.stringify(result)}`);
    return result as T;
  }

  /**
   * Split header value by comma, respecting quoted strings
   */
  private splitHeaderValue(value: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of value) {
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    if (current) {
      result.push(current);
    }

    return result;
  }

  /**
   * Parse the request body
   */
  private parseBody(body: CMCDv2RequestBody): {
    session: CMCDv2Session;
    events: CMCDv2Data[];
  } {
    const session: CMCDv2Session = body.session || {};
    const events: CMCDv2Data[] = [];

    // Single event format: { cmcd: { ... } }
    if (body.cmcd) {
      const cmcdData = body.cmcd;
      // Merge top-level session into cmcd data
      events.push({
        ...cmcdData,
        session: { ...session, ...cmcdData.session },
      });
    }

    // Batch events format: { session: { ... }, events: [ { ... }, ... ] }
    if (body.events && Array.isArray(body.events)) {
      for (const eventData of body.events) {
        // Merge shared session into each event
        events.push({
          ...eventData,
          session: { ...session, ...eventData.session },
        });
      }
    }

    return { session, events };
  }

  /**
   * Validate that the parsed data has required fields
   */
  validate(parsed: ParsedCMCDv2): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Session ID is required
    if (!parsed.session.sid && parsed.events.length > 0) {
      // Check if any event has a session ID
      const hasSessionId = parsed.events.some((e) => e.session?.sid);
      if (!hasSessionId) {
        errors.push("Missing required session.sid");
      }
    }

    // If we have events, each should have an event type or status info
    for (let i = 0; i < parsed.events.length; i++) {
      const event = parsed.events[i];
      if (!event.event?.e && !event.status?.bs) {
        // Allow events without explicit type if they have status (like buffer starvation)
        this.logger.debug(
          `Event ${i} has no event type or status, may be a status update`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
