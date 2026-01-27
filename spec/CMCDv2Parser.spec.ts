import Logger from "../logging/logger";
import { CMCDv2Parser } from "../lib/CMCDv2Parser";
import {
  testSession,
  singleEventBody,
  batchEventsBody,
  cmcdHeaders,
  invalidCmcdv2NoSession,
} from "./events/test_cmcdv2_events";

const parser = new CMCDv2Parser(Logger);

describe("CMCDv2Parser", () => {
  describe("parseBody", () => {
    it("should parse single event format (cmcd object)", () => {
      const parsed = parser.parse(singleEventBody, {});

      expect(parsed.session.sid).toBe("test-session-123");
      expect(parsed.events.length).toBe(1);
      expect(parsed.events[0].event?.e).toBe("ps");
      expect(parsed.events[0].event?.ts).toBe(1704067200000);
    });

    it("should parse batch events format", () => {
      const parsed = parser.parse(batchEventsBody, {});

      expect(parsed.session.sid).toBe("test-session-123");
      expect(parsed.events.length).toBe(3);
      expect(parsed.events[0].event?.e).toBe("ps");
      expect(parsed.events[1].event?.e).toBe("st");
      expect(parsed.events[2].event?.e).toBe("se");
    });

    it("should merge shared session into each event", () => {
      const parsed = parser.parse(batchEventsBody, {});

      for (const event of parsed.events) {
        expect(event.session?.sid).toBe("test-session-123");
        expect(event.session?.cid).toBe("video-content-456");
      }
    });

    it("should handle empty body", () => {
      const parsed = parser.parse({}, {});

      expect(parsed.events.length).toBe(0);
      expect(parsed.session).toEqual({});
    });
  });

  describe("parseHeaders", () => {
    it("should parse CMCD-Session header", () => {
      const parsed = parser.parse({}, cmcdHeaders);

      expect(parsed.session.sid).toBe("header-session-123");
      expect(parsed.session.cid).toBe("header-content");
      expect(parsed.session.v).toBe(2);
    });

    it("should parse CMCD-Object header", () => {
      const body = { cmcd: { event: { e: "ps" as const, ts: Date.now() } } };
      const parsed = parser.parse(body, cmcdHeaders);

      expect(parsed.events[0].object?.br).toBe(3000);
      expect(parsed.events[0].object?.d).toBe(4000);
      expect(parsed.events[0].object?.ot).toBe("v");
    });

    it("should parse CMCD-Request header", () => {
      const body = { cmcd: { event: { e: "ps" as const, ts: Date.now() } } };
      const parsed = parser.parse(body, cmcdHeaders);

      expect(parsed.events[0].request?.bl).toBe(5000);
      expect(parsed.events[0].request?.mtp).toBe(10000);
    });

    it("should parse CMCD-Status header with boolean flag", () => {
      const body = { cmcd: { event: { e: "ps" as const, ts: Date.now() } } };
      const parsed = parser.parse(body, cmcdHeaders);

      expect(parsed.events[0].status?.bs).toBe(true);
    });

    it("should handle case-insensitive header keys", () => {
      const headers = {
        "cmcd-session": 'sid="lower-case-123"',
      };
      const parsed = parser.parse({}, headers);

      expect(parsed.session.sid).toBe("lower-case-123");
    });

    it("should create synthetic event for buffer starvation header", () => {
      const parsed = parser.parse({}, { "CMCD-Status": "bs" });

      expect(parsed.events.length).toBe(1);
      expect(parsed.events[0].status?.bs).toBe(true);
    });
  });

  describe("merging headers and body", () => {
    it("should merge header data into body events", () => {
      const body = { cmcd: { event: { e: "ps" as const, ts: 1704067200000 } } };
      const headers = {
        "CMCD-Session": 'sid="header-sid"',
        "CMCD-Object": "br=1000",
      };

      const parsed = parser.parse(body, headers);

      expect(parsed.events[0].session?.sid).toBe("header-sid");
      expect(parsed.events[0].object?.br).toBe(1000);
    });

    it("should let body values override header values", () => {
      const body = {
        cmcd: {
          session: { sid: "body-sid" },
          event: { e: "ps" as const, ts: 1704067200000 },
        },
      };
      const headers = { "CMCD-Session": 'sid="header-sid"' };

      const parsed = parser.parse(body, headers);

      expect(parsed.events[0].session?.sid).toBe("body-sid");
    });
  });

  describe("validate", () => {
    it("should return valid for data with session ID", () => {
      const parsed = parser.parse(singleEventBody, {});
      const validation = parser.validate(parsed);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it("should return invalid for data missing session ID", () => {
      const parsed = parser.parse(invalidCmcdv2NoSession, {});
      const validation = parser.validate(parsed);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Missing required session.sid");
    });

    it("should be valid when session ID is in header", () => {
      const body = { cmcd: { event: { e: "ps" as const, ts: Date.now() } } };
      const headers = { "CMCD-Session": 'sid="header-session"' };

      const parsed = parser.parse(body, headers);
      const validation = parser.validate(parsed);

      expect(validation.valid).toBe(true);
    });
  });

  describe("header value parsing edge cases", () => {
    it("should handle quoted strings with special characters", () => {
      const headers = {
        "CMCD-Session": 'sid="session-with-dash_and_underscore"',
      };
      const parsed = parser.parse({}, headers);

      expect(parsed.session.sid).toBe("session-with-dash_and_underscore");
    });

    it("should handle numeric values", () => {
      const headers = { "CMCD-Object": "br=5000,d=4000.5" };
      const body = { cmcd: { event: { e: "ps" as const, ts: Date.now() } } };
      const parsed = parser.parse(body, headers);

      expect(parsed.events[0].object?.br).toBe(5000);
      expect(parsed.events[0].object?.d).toBe(4000.5);
    });

    it("should handle boolean flags (no value)", () => {
      const headers = { "CMCD-Request": "su,bl=1000" };
      const body = { cmcd: { event: { e: "ps" as const, ts: Date.now() } } };
      const parsed = parser.parse(body, headers);

      expect(parsed.events[0].request?.su).toBe(true);
      expect(parsed.events[0].request?.bl).toBe(1000);
    });

    it("should handle empty header value", () => {
      const headers = { "CMCD-Session": "" };
      const parsed = parser.parse({}, headers);

      expect(parsed.session).toEqual({});
    });
  });
});
