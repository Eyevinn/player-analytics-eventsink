const valid_events = [
  {
    event: 'init',
    sessionId: '123-214-234',
    timestamp: -1,
    playhead: -1,
    duration: -1,
  },
  {
    event: 'metadata',
    sessionId: '123-214-234',
    timestamp: -1,
    playhead: -1,
    duration: -1,
    payload: {
      live: false,
      contentTitle: 'My Content',
      contentId: '',
      contentUrl: '',
      drmType: '',
      userId: '',
      deviceId: '',
      deviceModel: '',
      deviceType: '',
    },
  },
  {
    event: 'heartbeat',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
    duration: 0,
  },
  {
    event: 'loading',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
    duration: 0,
  },
  {
    event: 'loaded',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
    duration: 0,
  },
  {
    event: 'playing',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
    duration: 0,
  },
  {
    event: 'paused',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
    duration: 0,
  },
  {
    event: 'buffering',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
    duration: 0,
  },
  {
    event: 'buffered',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
    duration: 0,
  },
  {
    event: 'seeking',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
    duration: 0,
  },
  {
    event: 'seeked',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
    duration: 0,
  },
  {
    event: 'bitrate_changed',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
    duration: 0,
    payload: {
      bitrate: 300,
      width: 1920,
      height: 1080,
      videoBitrate: 300,
      audioBitrate: 300,
    },
  },
  {
    event: 'stopped',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
    duration: 0,
    payload: {
      reason: 'ended', // eg. "ended", "aborted", "error"
    },
  },
  {
    event: 'error',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
    duration: 0,
    payload: {
      category: 'NETWORK', // eg. NETWORK, DECODER, etc.
      code: '',
      message: 'Network Error',
      data: {},
    },
  },
  {
    event: 'warning',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
    duration: 0,
    payload: {
      category: 'NETWORK', // eg. NETWORK, DECODER, osv.
      code: '404',
      message: 'Network Error',
      data: {},
    },
  },
];

const invalid_events = [
  {
    event: 'init',
    sessionId: '123-214-234',
  },
  {
    event: 'metadata',
    sessionId: '123-214-234',
    timestamp: 0,
  },
  {
    event: 'heartbeat',
    sessionId: '123-214-234',
    timestamp: 0,
    duration: 0,
  },
  {
    event: 'loading',
    sessionId: '123-214-234',
    timestamp: 0,
    duration: 0,
  },
  {
    event: 'loaded',
    sessionId: '123-214-234',
    playhead: 0,
    duration: 0,
  },
  {
    event: 'playing',
    sessionId: '123-214-234',
    timestamp: 0,
  },
  {
    event: 'pause',
    sessionId: '123-214-234',
    playhead: 0,
    duration: 0,
  },
  {
    event: 'resume',
    sessionId: '123-214-234',
    timestamp: 0,
    duration: 0,
  },
  {
    event: 'buffering',
    sessionId: '123-214-234',
    playhead: 0,
    duration: 0,
  },
  {
    event: 'buffered',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
  },
  {
    event: 'seeking',
    sessionId: '123-214-234',
    playhead: 0,
    duration: 0,
  },
  {
    event: 'seeked',
    sessionId: '123-214-234',
  },
  {
    event: 'bitrate_changed',
    sessionId: '123-214-234',
    timestamp: 0,
    duration: 0,
    payload: {},
  },
  {
    event: 'stopped',
    sessionId: '123-214-234',
    duration: 0,
    playhead: 0,
    payload: {},
  },
  {
    event: 'error',
    sessionId: '123-214-234',
  },
  {
    event: 'warning',
    sessionId: '123-214-234',
    timestamp: '',
    playhead: 0,
    duration: 0,
    payload: {
      category: 'NETWORK', // eg. NETWORK, DECODER, osv.
      code: '404',
      message: 'Network Error',
      data: {},
    },
  },
];

export { valid_events, invalid_events };
