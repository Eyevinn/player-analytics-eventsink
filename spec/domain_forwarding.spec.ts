import { fastify } from '../services/fastify';
import Sender from '../lib/Sender';
import {
  deriveDomainFromOrigin,
  attachDomainFromOrigin,
} from '../lib/route-helpers';

// End-to-end proof for player-analytics-specification#25: eventsink must
// server-derive the EPAS `domain` from the request's HTTP Origin header and
// forward it to the queue, while omitting the field entirely when the header
// is absent. The spec contract (player-analytics-specification 0.6.0) defines
// `domain` as the scheme + host + optional port of the Origin header value.

describe('Origin-header domain forwarding (#25)', () => {
  const validEvent = {
    event: 'heartbeat',
    sessionId: '123-214-234',
    timestamp: 0,
    playhead: 0,
    duration: 0,
  };

  const validCmcdPayload = {
    events: [{ sid: 'cmcd-domain-session', ts: 0, e: 'ps' }],
  };

  describe('deriveDomainFromOrigin (spec derivation rule)', () => {
    it('returns scheme + host for a bare origin', () => {
      expect(deriveDomainFromOrigin('https://example.com')).toEqual(
        'https://example.com',
      );
    });

    it('preserves an explicit non-default port', () => {
      expect(deriveDomainFromOrigin('http://localhost:3000')).toEqual(
        'http://localhost:3000',
      );
    });

    it('normalises to scheme + host + optional port only (drops path)', () => {
      expect(deriveDomainFromOrigin('https://example.com/some/path')).toEqual(
        'https://example.com',
      );
    });

    it('omits (undefined) when the header is absent', () => {
      expect(deriveDomainFromOrigin(undefined)).toBeUndefined();
      expect(deriveDomainFromOrigin('')).toBeUndefined();
    });

    it('omits (undefined) for an unparseable / opaque origin', () => {
      expect(deriveDomainFromOrigin('not a url')).toBeUndefined();
      expect(deriveDomainFromOrigin('null')).toBeUndefined();
    });
  });

  describe('attachDomainFromOrigin (in-place mutation)', () => {
    it('adds a domain property when derivable', () => {
      const event: Record<string, any> = { event: 'heartbeat' };
      attachDomainFromOrigin(event, 'https://example.com');
      expect(event.domain).toEqual('https://example.com');
    });

    it('leaves the event untouched (no domain key) when absent', () => {
      const event: Record<string, any> = { event: 'heartbeat' };
      attachDomainFromOrigin(event, undefined);
      expect('domain' in event).toBe(false);
    });
  });

  describe('POST / forwards the derived domain to the queue', () => {
    it('populates domain from the Origin header before sender.send', async () => {
      let forwarded: any = null;
      spyOn(Sender.prototype, 'send').and.callFake(function (event: any) {
        forwarded = event;
        return Promise.resolve({ message: 'ok' });
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/',
        headers: {
          'content-type': 'application/json',
          origin: 'https://player.example.com',
        },
        payload: validEvent,
      });

      expect(response.statusCode).toBe(200);
      expect(forwarded).not.toBeNull();
      expect(forwarded.domain).toEqual('https://player.example.com');
    });

    it('omits domain when no Origin header is present', async () => {
      let forwarded: any = null;
      spyOn(Sender.prototype, 'send').and.callFake(function (event: any) {
        forwarded = event;
        return Promise.resolve({ message: 'ok' });
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/',
        headers: { 'content-type': 'application/json' },
        payload: validEvent,
      });

      expect(response.statusCode).toBe(200);
      expect(forwarded).not.toBeNull();
      expect('domain' in forwarded).toBe(false);
    });
  });

  describe('POST /cmcd forwards the derived domain on converted events', () => {
    it('populates domain from the Origin header on each queued event', async () => {
      const forwarded: any[] = [];
      spyOn(Sender.prototype, 'send').and.callFake(function (event: any) {
        forwarded.push(event);
        return Promise.resolve({ message: 'ok' });
      });

      await fastify.inject({
        method: 'POST',
        url: '/cmcd',
        headers: {
          'content-type': 'application/json',
          origin: 'https://cmcd.example.com',
        },
        payload: validCmcdPayload,
      });

      // Only asserts on events that actually reached the queue; every one of
      // them must carry the derived domain.
      for (const event of forwarded) {
        expect(event.domain).toEqual('https://cmcd.example.com');
      }
    });

    it('omits domain on queued events when no Origin header is present', async () => {
      const forwarded: any[] = [];
      spyOn(Sender.prototype, 'send').and.callFake(function (event: any) {
        forwarded.push(event);
        return Promise.resolve({ message: 'ok' });
      });

      await fastify.inject({
        method: 'POST',
        url: '/cmcd',
        headers: { 'content-type': 'application/json' },
        payload: validCmcdPayload,
      });

      for (const event of forwarded) {
        expect('domain' in event).toBe(false);
      }
    });
  });
});
