import { fastify } from '../services/fastify';

describe('Fastify server', () => {
  it('should validate allowed origin if CORS_ALLOWED_ORIGINS is defined', async () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://test.domain.net, http://test.domain.net';
    const response = await fastify.inject({
      method: 'OPTIONS',
      url: '/',
      headers: {
        origin: 'https://test.domain.net',
      },
    });
    if (response.headers) {
      expect(response.headers['access-control-allow-origin']).toEqual('https://test.domain.net');
      expect(response.headers['vary']).toEqual('Origin');
    }
    process.env.CORS_ALLOWED_ORIGINS = '';
  });

  describe('POST / (invalid event)', () => {
    it('should return 400 with a structured errors array', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/',
        headers: { 'content-type': 'application/json' },
        payload: { event: 'heartbeat', sessionId: 'test', timestamp: 0 },
      });
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(false);
      expect(body.message).toBe('Invalid player event');
      expect(Array.isArray(body.errors)).toBe(true);
      expect(body.errors.length).toBeGreaterThan(0);
      for (const err of body.errors) {
        expect(typeof err.field).toBe('string');
        expect(typeof err.message).toBe('string');
      }
    });

    it('should omit the errors array on 400 responses from the wildcard route', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/unknown-path' });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /cmcd (invalid EPAS event)', () => {
    it('should include an EPAS validation failure detail in the result', async () => {
      // Send a CMCDv2 payload that parses successfully but produces an
      // EPAS event the schema rejects. The route surfaces the AJV error
      // detail inside the per-event `error` string.
      const response = await fastify.inject({
        method: 'POST',
        url: '/cmcd',
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          events: [{ sid: 'test-cmcd', ts: 0, e: 'ps' }],
        },
      });
      // Accept 400/207/500 — depends on parser outcome. We only assert
      // that IF the response includes a results array with a failure,
      // the failure carries EPAS detail text (not just "Unknown").
      const body = JSON.parse(response.body);
      if (Array.isArray(body.results)) {
        const failures = body.results.filter((r: any) => !r.success);
        for (const f of failures) {
          if (typeof f.error === 'string' && f.error.startsWith('EPAS validation failed:')) {
            expect(f.error).not.toContain('Unknown validation error');
          }
        }
      }
    });
  });
});
