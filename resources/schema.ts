const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'epas',
  title: 'Eyevinn Player Analytics Specification',
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
        { $ref: '#/definitions/paused' },
        { $ref: '#/definitions/playing' },
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
      required: ['event', 'sessionId', 'duration', 'playhead', 'timestamp', 'payload'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['bitrate_changed'],
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
            audioBitrate: {
              type: 'string',
            },
            bitrate: {
              type: 'string',
            },
            height: {
              type: 'string',
            },
            videoBitrate: {
              type: 'string',
            },
            width: {
              type: 'string',
            },
          },
          required: ['bitrate'],
          additionalProperties: false,
          type: 'object',
        },
      },
    },
    buffered: {
      required: ['event', 'sessionId', 'duration', 'playhead', 'timestamp'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['buffered'],
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
      },
    },
    buffering: {
      required: ['event', 'sessionId', 'duration', 'playhead', 'timestamp'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['buffering'],
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
      },
    },
    error: {
      required: ['event', 'sessionId', 'duration', 'playhead', 'timestamp', 'payload'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['error'],
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
      required: ['event', 'sessionId', 'duration', 'playhead', 'timestamp', 'payload'],
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
      required: ['duration', 'playhead', 'timestamp', 'sessionId', 'event'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['loading'],
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
      },
    },
    loaded: {
      required: ['duration', 'playhead', 'timestamp', 'sessionId', 'event'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['loaded'],
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
      },
    },
    playing: {
      required: ['duration', 'playhead', 'timestamp', 'sessionId', 'event'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['playing'],
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
      },
    },
    paused: {
      required: ['duration', 'playhead', 'timestamp', 'sessionId', 'event'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['paused'],
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
      },
    },
    seeking: {
      required: ['duration', 'playhead', 'timestamp', 'sessionId', 'event'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['seeking'],
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
      },
    },
    seeked: {
      required: ['duration', 'playhead', 'timestamp', 'sessionId', 'event'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['seeked'],
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
      },
    },
    warning: {
      required: ['event', 'duration', 'playhead', 'timestamp', 'sessionId', 'payload'],
      additionalProperties: false,
      type: 'object',
      properties: {
        event: {
          enum: ['warning'],
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
          },
          type: 'object',
          additionalProperties: false,
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
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  },
};

export { schema };
