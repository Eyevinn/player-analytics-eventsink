const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'epas',
  title: 'Player Analytics Specification',
  type: 'object',
  patternProperties: {
    '^.*$': {
      anyOf: [
        { $ref: '#/definitions/init' },
        { $ref: '#/definitions/bitrateChanged' },
        { $ref: '#/definitions/buffered' },
        { $ref: '#/definitions/buffering' },
        { $ref: '#/definitions/error' },
        { $ref: '#/definitions/heartbeat' },
        { $ref: '#/definitions/loaded' },
        { $ref: '#/definitions/loading' },
        { $ref: '#/definitions/pause' },
        { $ref: '#/definitions/play' },
        { $ref: '#/definitions/playing' },
        { $ref: '#/definitions/resume' },
        { $ref: '#/definitions/seeked' },
        { $ref: '#/definitions/seeking' },
        { $ref: '#/definitions/stopped' },
        { $ref: '#/definitions/warning' },
      ],
    },
  },
  definitions: {
    Record: {
      $id: '#Record',
      type: 'object',
    },
    bitrateChanged: {
      required: ['event', 'duration', 'playhead', 'timestamp', 'payload'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['bitrate_changed'],
          type: 'string',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
        payload: {
          properties: {
            audioBitrate: {
              type: 'number',
            },
            bitrate: {
              type: 'number',
            },
            height: {
              type: 'number',
            },
            videoBitrate: {
              type: 'number',
            },
            width: {
              type: 'number',
            },
          },
          required: ['bitrate'],
          additionalProperties: false,
          type: 'object',
        },
      },
    },
    buffered: {
      required: ['event', 'duration', 'playhead', 'timestamp'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['buffered'],
          type: 'string',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
      },
    },
    buffering: {
      required: ['event', 'duration', 'playhead', 'timestamp'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['buffering'],
          type: 'string',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
      },
    },
    error: {
      required: ['event', 'duration', 'playhead', 'timestamp', 'payload'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['error'],
          type: 'string',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
        payload: {
          properties: {
            category: {
              type: 'string',
            },
            code: {
              type: 'string',
            },
            data: {
              $ref: '#/definitions/Record',
            },
            message: {
              type: 'string',
            },
          },
          required: ['code'],
          additionalProperties: false,
          type: 'object',
        },
      },
    },
    init: {
      required: ['event', 'duration', 'playhead', 'timestamp', 'payload'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['init'],
          type: 'string',
        },
        sessionId: {
          type: 'string',
        },
        heartbeatInterval: {
          type: 'number',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
        payload: {
          properties: {
            contentId: {
              type: 'string',
            },
            contentUrl: {
              type: 'string',
            },
            deviceId: {
              type: 'string',
            },
            deviceModel: {
              type: 'string',
            },
            deviceType: {
              type: 'string',
            },
            drmType: {
              type: 'string',
            },
            live: {
              type: 'boolean',
            },
            userId: {
              type: 'string',
            },
          },
          required: ['contentId', 'contentUrl', 'live'],
          additionalProperties: false,
          type: 'object',
        },
      },
    },
    loading: {
      required: ['duration', 'playhead', 'timestamp', 'event'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['loading'],
          type: 'string',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
      },
    },
    loaded: {
      required: ['duration', 'playhead', 'timestamp', 'event'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['loaded'],
          type: 'string',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
      },
    },
    play: {
      required: ['duration', 'playhead', 'timestamp', 'event'],
      additionalProperties: false,
      type: 'object',
      properties: {
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
        event: {
          enum: ['play'],
          type: 'string',
        },
      },
    },
    playing: {
      required: ['duration', 'playhead', 'timestamp', 'event'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['playing'],
          type: 'string',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
      },
    },
    pause: {
      required: ['duration', 'playhead', 'timestamp', 'event'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['pause'],
          type: 'string',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
      },
    },
    resume: {
      required: ['duration', 'playhead', 'timestamp', 'event'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['resume'],
          type: 'string',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
      },
    },
    seeking: {
      required: ['duration', 'playhead', 'timestamp', 'event'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['seeking'],
          type: 'string',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
      },
    },
    seeked: {
      required: ['duration', 'playhead', 'timestamp', 'event'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['seeked'],
          type: 'string',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
      },
    },
    warning: {
      required: ['event', 'duration', 'playhead', 'timestamp', 'payload'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['warning'],
          type: 'string',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
        payload: {
          properties: {
            category: {
              type: 'string',
            },
            code: {
              type: 'string',
            },
            data: {
              $ref: '#/definitions/Record',
            },
            message: {
              type: 'string',
            },
          },
          required: ['code'],
          additionalProperties: false,
          type: 'object',
        },
      },
    },
    stopped: {
      required: ['duration', 'playhead', 'timestamp', 'event', 'sessionId'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['stopped'],
          type: 'string',
        },
        sessionId: {
          type: 'string',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
        payload: {
          properties: {
            reason: {
              type: 'string',
            },
            events: {
              type: 'array',
              items: {
                anyOf: [
                  { $ref: '#/definitions/init' },
                  { $ref: '#/definitions/bitrateChanged' },
                  { $ref: '#/definitions/buffered' },
                  { $ref: '#/definitions/buffering' },
                  { $ref: '#/definitions/error' },
                  { $ref: '#/definitions/heartbeat' },
                  { $ref: '#/definitions/loaded' },
                  { $ref: '#/definitions/loading' },
                  { $ref: '#/definitions/pause' },
                  { $ref: '#/definitions/play' },
                  { $ref: '#/definitions/playing' },
                  { $ref: '#/definitions/resume' },
                  { $ref: '#/definitions/seeked' },
                  { $ref: '#/definitions/seeking' },
                  { $ref: '#/definitions/stopped' },
                  { $ref: '#/definitions/warning' },
                ],
              },
            },
          },
          type: 'object',
        },
      },
    },
    heartbeat: {
      type: 'object',
      required: ['event', 'duration', 'playhead', 'timestamp', 'sessionId'],
      additionalProperties: false,
      properties: {
        event: {
          enum: ['heartbeat'],
          type: 'string',
        },
        sessionId: {
          type: 'string',
        },
        duration: {
          type: 'number',
        },
        playhead: {
          type: 'number',
        },
        timestamp: {
          type: 'number',
        },
        payload: {
          properties: {
            events: {
              type: 'array',
              items: {
                anyOf: [
                  { $ref: '#/definitions/init' },
                  { $ref: '#/definitions/bitrateChanged' },
                  { $ref: '#/definitions/buffered' },
                  { $ref: '#/definitions/buffering' },
                  { $ref: '#/definitions/error' },
                  { $ref: '#/definitions/heartbeat' },
                  { $ref: '#/definitions/loaded' },
                  { $ref: '#/definitions/loading' },
                  { $ref: '#/definitions/pause' },
                  { $ref: '#/definitions/play' },
                  { $ref: '#/definitions/playing' },
                  { $ref: '#/definitions/resume' },
                  { $ref: '#/definitions/seeked' },
                  { $ref: '#/definitions/seeking' },
                  { $ref: '#/definitions/stopped' },
                  { $ref: '#/definitions/warning' },
                ],
              },
            },
          },
          type: 'object',
          additionalProperties: false,
        },
      },
    },
  },
};

export { schema };
