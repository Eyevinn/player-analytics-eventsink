import { fastify } from '../services/fastify';
import Sender from '../lib/Sender';
import { normaliseUnits } from '../lib/route-helpers';

// Proof for eventsink#109 (breakdown of #104): the eventsink normalises
// `playhead`/`duration` to integer milliseconds at ingest on `POST /`, after
// validation and before forwarding. A client that declares an EPAS v0.7.0
// `sdk` is trusted to already emit ms; otherwise a legacy browser request
// (raw Origin header present, no `sdk`) is assumed to report fractional seconds
// and is converted seconds -> ms. A request without an Origin header (e.g. a
// native mobile client) is left unchanged.

describe('normaliseUnits (ms normalisation at ingest, #109)', () => {
  describe('unit rules', () => {
    it('leaves the event untouched when an sdk is declared (rule 1)', () => {
      const event: Record<string, any> = {
        event: 'heartbeat',
        playhead: 5.233816,
        duration: 300.141134,
        sdk: { name: 'web', version: '1.2.3' },
      };
      normaliseUnits(event, 'https://player.example.com');
      expect(event.playhead).toEqual(5.233816);
      expect(event.duration).toEqual(300.141134);
    });

    it('converts seconds -> ms when a raw Origin header is present (rule 2)', () => {
      const event: Record<string, any> = {
        event: 'heartbeat',
        playhead: 5.233816,
        duration: 300.141134,
      };
      normaliseUnits(event, 'https://player.example.com');
      expect(event.playhead).toEqual(5234);
      expect(event.duration).toEqual(300141);
    });

    it("converts when the raw Origin header is the string 'null' (rule 2)", () => {
      const event: Record<string, any> = {
        event: 'heartbeat',
        playhead: 5.233816,
        duration: 300.141134,
      };
      normaliseUnits(event, 'null');
      expect(event.playhead).toEqual(5234);
      expect(event.duration).toEqual(300141);
    });

    it('leaves the event unchanged when no Origin header is present (rule 3)', () => {
      const event: Record<string, any> = {
        event: 'heartbeat',
        playhead: 29949,
        duration: 63040,
      };
      normaliseUnits(event, undefined);
      expect(event.playhead).toEqual(29949);
      expect(event.duration).toEqual(63040);
    });

    it('leaves the event unchanged when the Origin header is an empty string', () => {
      const event: Record<string, any> = {
        event: 'heartbeat',
        playhead: 5.5,
        duration: 10.5,
      };
      normaliseUnits(event, '');
      expect(event.playhead).toEqual(5.5);
      expect(event.duration).toEqual(10.5);
    });

    it('never converts negative sentinel values (-1 = unknown)', () => {
      const event: Record<string, any> = {
        event: 'heartbeat',
        playhead: -1,
        duration: -1,
      };
      normaliseUnits(event, 'https://player.example.com');
      expect(event.playhead).toEqual(-1);
      expect(event.duration).toEqual(-1);
    });

    it('keeps 0 as 0', () => {
      const event: Record<string, any> = {
        event: 'heartbeat',
        playhead: 0,
        duration: 0,
      };
      normaliseUnits(event, 'https://player.example.com');
      expect(event.playhead).toEqual(0);
      expect(event.duration).toEqual(0);
    });

    it('converts only playhead and duration, not other numeric fields', () => {
      const event: Record<string, any> = {
        event: 'heartbeat',
        playhead: 1.5,
        duration: 2.5,
        timestamp: 1700000000,
      };
      normaliseUnits(event, 'https://player.example.com');
      expect(event.playhead).toEqual(1500);
      expect(event.duration).toEqual(2500);
      expect(event.timestamp).toEqual(1700000000);
    });
  });

  describe('POST / normalises before forwarding to the queue', () => {
    const inject = (headers: Record<string, string>, payload: any) => {
      let forwarded: any = null;
      spyOn(Sender.prototype, 'send').and.callFake(function (event: any) {
        forwarded = event;
        return Promise.resolve({ message: 'ok' });
      });
      return fastify
        .inject({
          method: 'POST',
          url: '/',
          headers: { 'content-type': 'application/json', ...headers },
          payload,
        })
        .then((response: any) => ({ response, forwarded: () => forwarded }));
    };

    it('converts browser seconds to ms (Origin set, no sdk)', async () => {
      const { response, forwarded } = await inject(
        { origin: 'https://player.example.com' },
        {
          event: 'heartbeat',
          sessionId: '123-214-234',
          timestamp: 0,
          playhead: 5.233816,
          duration: 300.141134,
        },
      );
      expect(response.statusCode).toBe(200);
      expect(forwarded().playhead).toEqual(5234);
      expect(forwarded().duration).toEqual(300141);
    });

    it("converts when Origin is the string 'null'", async () => {
      const { response, forwarded } = await inject(
        { origin: 'null' },
        {
          event: 'heartbeat',
          sessionId: '123-214-234',
          timestamp: 0,
          playhead: 5.233816,
          duration: 300.141134,
        },
      );
      expect(response.statusCode).toBe(200);
      expect(forwarded().playhead).toEqual(5234);
      expect(forwarded().duration).toEqual(300141);
    });

    it('leaves mobile ms unchanged when no Origin header is present', async () => {
      const { response, forwarded } = await inject(
        {},
        {
          event: 'heartbeat',
          sessionId: '123-214-234',
          timestamp: 0,
          playhead: 29949,
          duration: 63040,
        },
      );
      expect(response.statusCode).toBe(200);
      expect(forwarded().playhead).toEqual(29949);
      expect(forwarded().duration).toEqual(63040);
    });

    it('leaves the event unchanged when an sdk is declared, even with an Origin', async () => {
      const { response, forwarded } = await inject(
        { origin: 'https://player.example.com' },
        {
          event: 'heartbeat',
          sessionId: '123-214-234',
          timestamp: 0,
          playhead: 29949,
          duration: 63040,
          sdk: { name: 'web', version: '1.2.3' },
        },
      );
      expect(response.statusCode).toBe(200);
      expect(forwarded().playhead).toEqual(29949);
      expect(forwarded().duration).toEqual(63040);
    });

    it('keeps -1 as -1', async () => {
      const { response, forwarded } = await inject(
        { origin: 'https://player.example.com' },
        {
          event: 'heartbeat',
          sessionId: '123-214-234',
          timestamp: 0,
          playhead: -1,
          duration: -1,
        },
      );
      expect(response.statusCode).toBe(200);
      expect(forwarded().playhead).toEqual(-1);
      expect(forwarded().duration).toEqual(-1);
    });

    it('keeps 0 as 0', async () => {
      const { response, forwarded } = await inject(
        { origin: 'https://player.example.com' },
        {
          event: 'heartbeat',
          sessionId: '123-214-234',
          timestamp: 0,
          playhead: 0,
          duration: 0,
        },
      );
      expect(response.statusCode).toBe(200);
      expect(forwarded().playhead).toEqual(0);
      expect(forwarded().duration).toEqual(0);
    });
  });
});
