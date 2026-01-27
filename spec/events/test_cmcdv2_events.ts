import {
  CMCDv2Data,
  CMCDv2RequestBody,
  CMCDv2Session,
} from "../../types/cmcdv2";
import { EPASEvent } from "../../lib/CMCDv2Converter";

// Test fixtures for CMCDv2 events

// Basic session for testing
export const testSession: CMCDv2Session = {
  sid: "test-session-123",
  cid: "video-content-456",
  v: 2,
  sf: "d", // DASH
  st: "v", // VOD
  pr: 1, // normal playback rate
};

// Single CMCDv2 events
export const cmcdv2PlaybackStart: CMCDv2Data = {
  session: testSession,
  event: { e: "ps", ts: 1704067200000 },
};

export const cmcdv2Stall: CMCDv2Data = {
  session: testSession,
  event: { e: "st", ts: 1704067210000 },
  request: { bl: 0 },
};

export const cmcdv2Error: CMCDv2Data = {
  session: testSession,
  event: { e: "er", ts: 1704067220000 },
  response: { rc: 404, url: "https://example.com/segment.m4s" },
};

export const cmcdv2Seek: CMCDv2Data = {
  session: testSession,
  event: { e: "se", ts: 1704067230000 },
};

export const cmcdv2SpeedChange: CMCDv2Data = {
  session: { ...testSession, pr: 2 },
  event: { e: "sp", ts: 1704067240000 },
};

export const cmcdv2AdStart: CMCDv2Data = {
  session: testSession,
  event: { e: "as", ts: 1704067250000 },
};

export const cmcdv2AdEnd: CMCDv2Data = {
  session: testSession,
  event: { e: "ae", ts: 1704067260000 },
};

export const cmcdv2InterstitialStart: CMCDv2Data = {
  session: testSession,
  event: { e: "is", ts: 1704067270000 },
};

export const cmcdv2InterstitialEnd: CMCDv2Data = {
  session: testSession,
  event: { e: "ie", ts: 1704067280000 },
};

export const cmcdv2ContentChange: CMCDv2Data = {
  session: { ...testSession, cid: "new-content-789" },
  event: { e: "cc", ts: 1704067290000 },
};

export const cmcdv2BufferStarvation: CMCDv2Data = {
  session: testSession,
  status: { bs: true },
};

export const cmcdv2BitrateChange: CMCDv2Data = {
  session: testSession,
  object: { br: 5000, d: 4000, ot: "v", tb: 8000 },
};

// Request body formats
export const singleEventBody: CMCDv2RequestBody = {
  cmcd: cmcdv2PlaybackStart,
};

export const batchEventsBody: CMCDv2RequestBody = {
  session: testSession,
  events: [
    { event: { e: "ps", ts: 1704067200000 } },
    { event: { e: "st", ts: 1704067210000 } },
    { event: { e: "se", ts: 1704067220000 } },
  ],
};

// Expected EPAS outputs
export const expectedPlaybackStartEPAS: EPASEvent[] = [
  {
    event: "init",
    sessionId: "test-session-123",
    timestamp: 1704067200000,
    playhead: -1,
    duration: -1,
  },
  {
    event: "playing",
    sessionId: "test-session-123",
    timestamp: 1704067200000,
    playhead: 0,
    duration: 0,
  },
];

export const expectedStallEPAS: EPASEvent[] = [
  {
    event: "buffering",
    sessionId: "test-session-123",
    timestamp: 1704067210000,
    playhead: 0,
    duration: 0,
  },
];

export const expectedErrorEPAS: EPASEvent[] = [
  {
    event: "error",
    sessionId: "test-session-123",
    timestamp: 1704067220000,
    playhead: 0,
    duration: 0,
    payload: {
      category: "NETWORK",
      code: "404",
      message: "HTTP 404",
      data: { url: "https://example.com/segment.m4s" },
    },
  },
];

export const expectedSeekEPAS: EPASEvent[] = [
  {
    event: "seeking",
    sessionId: "test-session-123",
    timestamp: 1704067230000,
    playhead: 0,
    duration: 0,
  },
];

export const expectedSpeedChangeEPAS: EPASEvent[] = [
  {
    event: "heartbeat",
    sessionId: "test-session-123",
    timestamp: 1704067240000,
    playhead: 0,
    duration: 0,
    payload: { playbackRate: 2 },
  },
];

// CMCD header test data
export const cmcdHeaders = {
  "CMCD-Session": 'sid="header-session-123",cid="header-content",v=2',
  "CMCD-Object": "br=3000,d=4000,ot=v",
  "CMCD-Request": "bl=5000,mtp=10000",
  "CMCD-Status": "bs",
};

// Invalid CMCDv2 data for testing error handling
export const invalidCmcdv2NoSession: CMCDv2RequestBody = {
  cmcd: {
    event: { e: "ps", ts: 1704067200000 },
  },
};

export const invalidCmcdv2EmptyEvents: CMCDv2RequestBody = {
  session: testSession,
  events: [],
};
