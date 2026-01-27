// CMCDv2 (Common Media Client Data version 2) TypeScript interfaces
// Based on CTA-5004 specification

// CMCDv2 event types
export type CMCDv2EventType =
  | "ps" // playback start
  | "st" // stall (rebuffering)
  | "er" // error
  | "as" // ad start
  | "ae" // ad end
  | "is" // interstitial start
  | "ie" // interstitial end
  | "cc" // content change
  | "sp" // speed change
  | "se"; // seek

// CMCDv2 Session object (CMCD-Session header)
export interface CMCDv2Session {
  sid?: string; // Session ID
  cid?: string; // Content ID
  v?: number; // CMCD version (should be 2)
  sf?: string; // Streaming format (d=DASH, h=HLS, s=Smooth, o=other)
  st?: string; // Stream type (v=VOD, l=Live)
  pr?: number; // Playback rate
}

// CMCDv2 Object info (CMCD-Object header)
export interface CMCDv2Object {
  br?: number; // Encoded bitrate in kbps
  d?: number; // Object duration in milliseconds
  ot?: string; // Object type (m=manifest, a=audio, v=video, av=muxed, i=init, c=caption, tt=timed text, k=key, o=other)
  tb?: number; // Top bitrate in kbps
}

// CMCDv2 Request info (CMCD-Request header)
export interface CMCDv2Request {
  bl?: number; // Buffer length in milliseconds
  dl?: number; // Deadline in milliseconds
  mtp?: number; // Measured throughput in kbps
  su?: boolean; // Startup flag
}

// CMCDv2 Status info (CMCD-Status header)
export interface CMCDv2Status {
  bs?: boolean; // Buffer starvation flag
  rtp?: number; // Requested maximum throughput in kbps
}

// CMCDv2 Response info (for response-based reporting)
export interface CMCDv2Response {
  rc?: number; // Response code (HTTP status)
  ttfb?: number; // Time to first byte in milliseconds
  ttlb?: number; // Time to last byte in milliseconds
  url?: string; // Request URL
}

// CMCDv2 Event info
export interface CMCDv2Event {
  e?: CMCDv2EventType; // Event type
  ts?: number; // Timestamp in milliseconds since Unix epoch
}

// Complete CMCDv2 data structure
export interface CMCDv2Data {
  session?: CMCDv2Session;
  object?: CMCDv2Object;
  request?: CMCDv2Request;
  status?: CMCDv2Status;
  response?: CMCDv2Response;
  event?: CMCDv2Event;
}

// CMCDv2 request body structure (for POST requests)
export interface CMCDv2RequestBody {
  // Single event format
  cmcd?: CMCDv2Data;
  // Batch events format
  events?: CMCDv2Data[];
  // Shared session info for batch events
  session?: CMCDv2Session;
}

// Parsed CMCDv2 result from parser
export interface ParsedCMCDv2 {
  session: CMCDv2Session;
  events: CMCDv2Data[];
}
