import Logger from "../logging/logger";
import { CMCDv2Converter } from "../lib/CMCDv2Converter";
import {
  testSession,
  cmcdv2PlaybackStart,
  cmcdv2Stall,
  cmcdv2Error,
  cmcdv2Seek,
  cmcdv2SpeedChange,
  cmcdv2AdStart,
  cmcdv2AdEnd,
  cmcdv2InterstitialStart,
  cmcdv2InterstitialEnd,
  cmcdv2ContentChange,
  cmcdv2BufferStarvation,
  cmcdv2BitrateChange,
} from "./events/test_cmcdv2_events";

describe("CMCDv2Converter", () => {
  let converter: CMCDv2Converter;

  beforeEach(() => {
    converter = new CMCDv2Converter(Logger);
  });

  afterEach(() => {
    converter.destroy();
  });

  describe("playback start (ps)", () => {
    it("should convert to init + playing events", () => {
      const events = converter.convert([cmcdv2PlaybackStart]);

      expect(events.length).toBe(2);
      expect(events[0].event).toBe("init");
      expect(events[0].sessionId).toBe("test-session-123");
      expect(events[0].timestamp).toBe(1704067200000);
      expect(events[0].playhead).toBe(-1);
      expect(events[0].duration).toBe(-1);

      expect(events[1].event).toBe("playing");
      expect(events[1].sessionId).toBe("test-session-123");
    });
  });

  describe("stall (st)", () => {
    it("should convert to buffering event", () => {
      const events = converter.convert([cmcdv2Stall]);

      expect(events.length).toBe(1);
      expect(events[0].event).toBe("buffering");
      expect(events[0].sessionId).toBe("test-session-123");
      expect(events[0].timestamp).toBe(1704067210000);
    });
  });

  describe("error (er)", () => {
    it("should convert to error event with response data", () => {
      const events = converter.convert([cmcdv2Error]);

      expect(events.length).toBe(1);
      expect(events[0].event).toBe("error");
      expect(events[0].payload?.category).toBe("NETWORK");
      expect(events[0].payload?.code).toBe("404");
      expect(events[0].payload?.message).toBe("HTTP 404");
      expect(events[0].payload?.data?.url).toBe(
        "https://example.com/segment.m4s",
      );
    });
  });

  describe("seek (se)", () => {
    it("should convert to seeking event", () => {
      const events = converter.convert([cmcdv2Seek]);

      expect(events.length).toBe(1);
      expect(events[0].event).toBe("seeking");
      expect(events[0].timestamp).toBe(1704067230000);
    });
  });

  describe("speed change (sp)", () => {
    it("should convert to heartbeat event with playbackRate", () => {
      const events = converter.convert([cmcdv2SpeedChange]);

      expect(events.length).toBe(1);
      expect(events[0].event).toBe("heartbeat");
      expect(events[0].payload?.playbackRate).toBe(2);
    });
  });

  describe("ad start (as)", () => {
    it("should convert to metadata event with ad info", () => {
      const events = converter.convert([cmcdv2AdStart]);

      expect(events.length).toBe(1);
      expect(events[0].event).toBe("metadata");
      expect(events[0].payload?.adEvent).toBe("start");
      expect(events[0].payload?.contentId).toBe("video-content-456");
    });
  });

  describe("ad end (ae)", () => {
    it("should convert to metadata event with ad end info", () => {
      const events = converter.convert([cmcdv2AdEnd]);

      expect(events.length).toBe(1);
      expect(events[0].event).toBe("metadata");
      expect(events[0].payload?.adEvent).toBe("end");
    });
  });

  describe("interstitial start (is)", () => {
    it("should convert to metadata event with interstitial info", () => {
      const events = converter.convert([cmcdv2InterstitialStart]);

      expect(events.length).toBe(1);
      expect(events[0].event).toBe("metadata");
      expect(events[0].payload?.interstitialEvent).toBe("start");
    });
  });

  describe("interstitial end (ie)", () => {
    it("should convert to metadata event with interstitial end info", () => {
      const events = converter.convert([cmcdv2InterstitialEnd]);

      expect(events.length).toBe(1);
      expect(events[0].event).toBe("metadata");
      expect(events[0].payload?.interstitialEvent).toBe("end");
    });
  });

  describe("content change (cc)", () => {
    it("should convert to metadata event with new content ID", () => {
      const events = converter.convert([cmcdv2ContentChange]);

      expect(events.length).toBe(1);
      expect(events[0].event).toBe("metadata");
      expect(events[0].payload?.contentChange).toBe(true);
      expect(events[0].payload?.contentId).toBe("new-content-789");
    });
  });

  describe("buffer starvation (bs)", () => {
    it("should convert to buffering event from status", () => {
      const events = converter.convert([cmcdv2BufferStarvation]);

      expect(events.length).toBe(1);
      expect(events[0].event).toBe("buffering");
    });

    it("should not duplicate buffering if already buffering", () => {
      // First event triggers buffering
      converter.convert([cmcdv2BufferStarvation]);

      // Second event with same session should not add another buffering
      const events = converter.convert([cmcdv2BufferStarvation]);

      // Only one buffering event since state is already buffering
      expect(events.filter((e) => e.event === "buffering").length).toBe(0);
    });
  });

  describe("bitrate change", () => {
    it("should generate bitrate_changed event when bitrate changes", () => {
      const events = converter.convert([cmcdv2BitrateChange]);

      expect(events.some((e) => e.event === "bitrate_changed")).toBe(true);
      const bitrateEvent = events.find((e) => e.event === "bitrate_changed");
      expect(bitrateEvent?.payload?.bitrate).toBe(5000);
    });

    it("should not duplicate bitrate_changed for same bitrate", () => {
      // First conversion
      converter.convert([cmcdv2BitrateChange]);

      // Second conversion with same bitrate
      const events = converter.convert([cmcdv2BitrateChange]);

      expect(events.filter((e) => e.event === "bitrate_changed").length).toBe(
        0,
      );
    });
  });

  describe("duration conversion", () => {
    it("should convert duration from ms to seconds", () => {
      const cmcdWithDuration = {
        session: testSession,
        object: { d: 4000 }, // 4000ms = 4s
        event: { e: "ps" as const, ts: Date.now() },
      };

      const events = converter.convert([cmcdWithDuration]);
      const playingEvent = events.find((e) => e.event === "playing");

      expect(playingEvent?.duration).toBe(4);
    });
  });

  describe("session state management", () => {
    it("should track session state across multiple events", () => {
      converter.convert([cmcdv2PlaybackStart]);

      const state = converter.getSessionState("test-session-123");
      expect(state).toBeDefined();
      expect(state?.isBuffering).toBe(false);
    });

    it("should update buffering state", () => {
      converter.convert([cmcdv2PlaybackStart]);
      converter.convert([cmcdv2Stall]);

      const state = converter.getSessionState("test-session-123");
      expect(state?.isBuffering).toBe(true);
    });

    it("should clear buffering state on playback start", () => {
      converter.convert([cmcdv2Stall]);
      converter.convert([cmcdv2PlaybackStart]);

      const state = converter.getSessionState("test-session-123");
      expect(state?.isBuffering).toBe(false);
    });

    it("should clear session states on clearSessionStates()", () => {
      converter.convert([cmcdv2PlaybackStart]);

      expect(converter.getSessionState("test-session-123")).toBeDefined();

      converter.clearSessionStates();

      expect(converter.getSessionState("test-session-123")).toBeUndefined();
    });
  });

  describe("shared session", () => {
    it("should merge shared session with event session", () => {
      const eventWithoutSession = {
        event: { e: "ps" as const, ts: 1704067200000 },
      };

      const events = converter.convert([eventWithoutSession], testSession);

      expect(events[0].sessionId).toBe("test-session-123");
    });
  });

  describe("batch conversion", () => {
    it("should convert multiple events", () => {
      const cmcdEvents = [cmcdv2PlaybackStart, cmcdv2Stall, cmcdv2Seek];

      const events = converter.convert(cmcdEvents);

      // ps -> init + playing, st -> buffering, se -> seeking
      expect(events.length).toBe(4);
      expect(events[0].event).toBe("init");
      expect(events[1].event).toBe("playing");
      expect(events[2].event).toBe("buffering");
      expect(events[3].event).toBe("seeking");
    });
  });

  describe("unknown event type", () => {
    it("should handle unknown event types gracefully", () => {
      const unknownEvent = {
        session: testSession,
        event: { e: "unknown" as any, ts: Date.now() },
      };

      const events = converter.convert([unknownEvent]);

      // Should not throw, may return empty or minimal events
      expect(events).toBeDefined();
    });
  });

  describe("missing session ID", () => {
    it('should use "unknown" as session ID when missing', () => {
      const eventNoSession = {
        event: { e: "ps" as const, ts: Date.now() },
      };

      const events = converter.convert([eventNoSession]);

      expect(events[0].sessionId).toBe("unknown");
    });
  });

  describe("timestamp handling", () => {
    it("should use current time when timestamp is missing", () => {
      const now = Date.now();
      const eventNoTimestamp = {
        session: testSession,
        event: { e: "ps" as const },
      };

      const events = converter.convert([eventNoTimestamp]);

      // Timestamp should be close to now
      expect(events[0].timestamp).toBeGreaterThanOrEqual(now);
      expect(events[0].timestamp).toBeLessThan(now + 1000);
    });
  });
});
