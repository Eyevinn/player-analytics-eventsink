import winston from "winston";
import { CMCDv2Data, CMCDv2Session, CMCDv2EventType } from "../types/cmcdv2";

// EPAS event types that we convert to
export type EPASEventType =
  | "init"
  | "metadata"
  | "heartbeat"
  | "loading"
  | "loaded"
  | "playing"
  | "paused"
  | "buffering"
  | "buffered"
  | "seeking"
  | "seeked"
  | "bitrate_changed"
  | "stopped"
  | "error"
  | "warning";

// EPAS event structure
export interface EPASEvent {
  event: EPASEventType;
  sessionId: string;
  timestamp: number;
  playhead: number;
  duration: number;
  payload?: Record<string, any>;
}

// Session state for tracking playback
interface SessionState {
  playhead: number;
  duration: number;
  isBuffering: boolean;
  lastBitrate?: number;
  lastTimestamp: number;
  playbackRate: number;
}

// Session cleanup interval (30 minutes)
const SESSION_CLEANUP_INTERVAL = 30 * 60 * 1000;

export class CMCDv2Converter {
  private logger: winston.Logger;
  private sessionStates: Map<string, SessionState> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.startSessionCleanup();
  }

  /**
   * Convert CMCDv2 events to EPAS format
   */
  convert(
    cmcdEvents: CMCDv2Data[],
    sharedSession?: CMCDv2Session,
  ): EPASEvent[] {
    const epasEvents: EPASEvent[] = [];

    for (const cmcdEvent of cmcdEvents) {
      const session = { ...sharedSession, ...cmcdEvent.session };
      const converted = this.convertSingleEvent(cmcdEvent, session);
      epasEvents.push(...converted);
    }

    return epasEvents;
  }

  /**
   * Convert a single CMCDv2 event to one or more EPAS events
   */
  private convertSingleEvent(
    cmcd: CMCDv2Data,
    session: CMCDv2Session,
  ): EPASEvent[] {
    const events: EPASEvent[] = [];
    const sessionId = session.sid || "unknown";
    const timestamp = cmcd.event?.ts || Date.now();
    const eventType = cmcd.event?.e;

    // Get or create session state
    let state = this.sessionStates.get(sessionId);
    if (!state) {
      state = {
        playhead: 0,
        duration: 0,
        isBuffering: false,
        lastTimestamp: timestamp,
        playbackRate: session.pr || 1,
      };
      this.sessionStates.set(sessionId, state);
    }

    // Update state from request data
    if (cmcd.object?.d) {
      // Duration in CMCD is in ms, EPAS uses seconds
      state.duration = cmcd.object.d / 1000;
    }

    // Estimate playhead from buffer length and time elapsed
    if (cmcd.request?.bl !== undefined) {
      // Buffer length gives us a hint about playhead
      // This is an approximation; real playhead would need explicit reporting
    }

    // Update timestamp
    state.lastTimestamp = timestamp;

    // Handle buffer starvation from status
    if (cmcd.status?.bs === true && !state.isBuffering) {
      events.push(
        this.createEPASEvent("buffering", sessionId, timestamp, state),
      );
      state.isBuffering = true;
    }

    // Handle bitrate changes
    if (cmcd.object?.br !== undefined && cmcd.object.br !== state.lastBitrate) {
      events.push(
        this.createBitrateChangedEvent(
          sessionId,
          timestamp,
          state,
          cmcd.object.br,
        ),
      );
      state.lastBitrate = cmcd.object.br;
    }

    // Map CMCDv2 event types to EPAS events
    if (eventType) {
      const mappedEvents = this.mapEventType(
        eventType,
        sessionId,
        timestamp,
        state,
        cmcd,
        session,
      );
      events.push(...mappedEvents);
    }

    // Update session state
    this.sessionStates.set(sessionId, state);

    return events;
  }

  /**
   * Map CMCDv2 event type to EPAS event(s)
   */
  private mapEventType(
    eventType: CMCDv2EventType,
    sessionId: string,
    timestamp: number,
    state: SessionState,
    cmcd: CMCDv2Data,
    session: CMCDv2Session,
  ): EPASEvent[] {
    const events: EPASEvent[] = [];

    switch (eventType) {
      case "ps": // playback start
        // Generate init + playing events
        events.push(this.createInitEvent(sessionId, timestamp, state));
        events.push(
          this.createEPASEvent("playing", sessionId, timestamp, state),
        );
        state.isBuffering = false;
        break;

      case "st": // stall (rebuffering)
        events.push(
          this.createEPASEvent("buffering", sessionId, timestamp, state),
        );
        state.isBuffering = true;
        break;

      case "er": // error
        events.push(
          this.createErrorEvent(sessionId, timestamp, state, cmcd.response),
        );
        break;

      case "se": // seek
        events.push(
          this.createEPASEvent("seeking", sessionId, timestamp, state),
        );
        break;

      case "sp": // speed change
        state.playbackRate = session.pr || 1;
        events.push(
          this.createEPASEvent("heartbeat", sessionId, timestamp, state, {
            playbackRate: state.playbackRate,
          }),
        );
        break;

      case "as": // ad start
        events.push(
          this.createEPASEvent("metadata", sessionId, timestamp, state, {
            adEvent: "start",
            contentId: session.cid,
          }),
        );
        break;

      case "ae": // ad end
        events.push(
          this.createEPASEvent("metadata", sessionId, timestamp, state, {
            adEvent: "end",
            contentId: session.cid,
          }),
        );
        break;

      case "is": // interstitial start
        events.push(
          this.createEPASEvent("metadata", sessionId, timestamp, state, {
            interstitialEvent: "start",
            contentId: session.cid,
          }),
        );
        break;

      case "ie": // interstitial end
        events.push(
          this.createEPASEvent("metadata", sessionId, timestamp, state, {
            interstitialEvent: "end",
            contentId: session.cid,
          }),
        );
        break;

      case "cc": // content change
        events.push(
          this.createEPASEvent("metadata", sessionId, timestamp, state, {
            contentChange: true,
            contentId: session.cid,
          }),
        );
        break;

      default:
        this.logger.debug(`Unknown CMCDv2 event type: ${eventType}`);
    }

    return events;
  }

  /**
   * Create a basic EPAS event
   */
  private createEPASEvent(
    eventType: EPASEventType,
    sessionId: string,
    timestamp: number,
    state: SessionState,
    payload?: Record<string, any>,
  ): EPASEvent {
    const event: EPASEvent = {
      event: eventType,
      sessionId,
      timestamp,
      playhead: state.playhead,
      duration: state.duration,
    };

    if (payload) {
      event.payload = payload;
    }

    return event;
  }

  /**
   * Create an init event
   */
  private createInitEvent(
    sessionId: string,
    timestamp: number,
    state: SessionState,
  ): EPASEvent {
    return {
      event: "init",
      sessionId,
      timestamp,
      playhead: -1,
      duration: -1,
    };
  }

  /**
   * Create a bitrate_changed event
   */
  private createBitrateChangedEvent(
    sessionId: string,
    timestamp: number,
    state: SessionState,
    bitrate: number,
  ): EPASEvent {
    return {
      event: "bitrate_changed",
      sessionId,
      timestamp,
      playhead: state.playhead,
      duration: state.duration,
      payload: {
        bitrate,
        width: 0,
        height: 0,
        videoBitrate: bitrate,
        audioBitrate: 0,
      },
    };
  }

  /**
   * Create an error event
   */
  private createErrorEvent(
    sessionId: string,
    timestamp: number,
    state: SessionState,
    response?: { rc?: number; url?: string },
  ): EPASEvent {
    return {
      event: "error",
      sessionId,
      timestamp,
      playhead: state.playhead,
      duration: state.duration,
      payload: {
        category: "NETWORK",
        code: response?.rc?.toString() || "",
        message: response?.rc ? `HTTP ${response.rc}` : "Unknown error",
        data: response?.url ? { url: response.url } : {},
      },
    };
  }

  /**
   * Start periodic cleanup of stale sessions
   */
  private startSessionCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = now - SESSION_CLEANUP_INTERVAL;

      for (const [sessionId, state] of this.sessionStates.entries()) {
        if (state.lastTimestamp < staleThreshold) {
          this.logger.debug(`Cleaning up stale session: ${sessionId}`);
          this.sessionStates.delete(sessionId);
        }
      }
    }, SESSION_CLEANUP_INTERVAL);

    // Don't let this interval keep the process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.sessionStates.clear();
  }

  /**
   * Get session state (for testing)
   */
  getSessionState(sessionId: string): SessionState | undefined {
    return this.sessionStates.get(sessionId);
  }

  /**
   * Clear all session states (for testing)
   */
  clearSessionStates(): void {
    this.sessionStates.clear();
  }
}
