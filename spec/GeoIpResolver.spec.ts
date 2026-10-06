import {
  GeoIpResolver,
  GeoLocation,
  isPrivateOrReservedIp,
  mapCityResponse,
} from "../lib/GeoIpResolver";
import { attachGeoFromIp, parseTrustProxyEnv } from "../lib/route-helpers";

/**
 * A mock resolver that returns a canned location for a known public IP and
 * `undefined` for everything else — stands in for the real MMDB-backed
 * resolver so these tests need no database file.
 */
class MockGeoIpResolver implements GeoIpResolver {
  constructor(private readonly byIp: Record<string, GeoLocation>) {}
  lookup(ip: string): GeoLocation | undefined {
    return this.byIp[ip];
  }
}

const metadataEvent = () => ({
  event: "metadata",
  sessionId: "s1",
  timestamp: 0,
  payload: { contentId: "abc" },
});

describe("GeoIpResolver / geo enrichment", () => {
  describe("attachGeoFromIp (mocked resolver)", () => {
    it("sets country and city on a metadata event from a public IP", () => {
      const resolver = new MockGeoIpResolver({
        "8.8.8.8": { country: "US", city: "Mountain View" },
      });
      const event = metadataEvent();
      attachGeoFromIp(event, "8.8.8.8", resolver);
      expect((event as any).country).toBe("US");
      expect((event as any).city).toBe("Mountain View");
    });

    it("omits the fields when the IP is missing", () => {
      const resolver = new MockGeoIpResolver({
        "8.8.8.8": { country: "US", city: "Mountain View" },
      });
      const event = metadataEvent();
      attachGeoFromIp(event, undefined, resolver);
      expect((event as any).country).toBeUndefined();
      expect((event as any).city).toBeUndefined();
    });

    it("omits the fields for a private IP (never calls the resolver)", () => {
      let called = false;
      const resolver: GeoIpResolver = {
        lookup: () => {
          called = true;
          return { country: "US", city: "Mountain View" };
        },
      };
      const event = metadataEvent();
      attachGeoFromIp(event, "192.168.1.20", resolver);
      expect(called).toBe(false);
      expect((event as any).country).toBeUndefined();
      expect((event as any).city).toBeUndefined();
    });

    it("omits the fields when the lookup does not resolve", () => {
      const resolver = new MockGeoIpResolver({});
      const event = metadataEvent();
      attachGeoFromIp(event, "8.8.8.8", resolver);
      expect((event as any).country).toBeUndefined();
      expect((event as any).city).toBeUndefined();
    });

    it("does nothing when enrichment is disabled (no resolver)", () => {
      const event = metadataEvent();
      attachGeoFromIp(event, "8.8.8.8", undefined);
      expect((event as any).country).toBeUndefined();
      expect((event as any).city).toBeUndefined();
    });

    it("leaves non-metadata events untouched", () => {
      const resolver = new MockGeoIpResolver({
        "8.8.8.8": { country: "US", city: "Mountain View" },
      });
      const event: any = { event: "heartbeat", sessionId: "s1", timestamp: 0 };
      attachGeoFromIp(event, "8.8.8.8", resolver);
      expect(event.country).toBeUndefined();
      expect(event.city).toBeUndefined();
    });

    it("sets only the fields the lookup resolves", () => {
      const resolver = new MockGeoIpResolver({
        "8.8.8.8": { country: "SE" },
      });
      const event = metadataEvent();
      attachGeoFromIp(event, "8.8.8.8", resolver);
      expect((event as any).country).toBe("SE");
      expect((event as any).city).toBeUndefined();
    });
  });

  describe("isPrivateOrReservedIp", () => {
    const privateOrReserved = [
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.0.1",
      "127.0.0.1",
      "169.254.10.1",
      "100.64.0.1",
      "0.0.0.0",
      "203.0.113.5",
      "::1",
      "::",
      "fe80::1",
      "fd00::1",
      "fc00::1",
      "::ffff:192.168.0.1",
      "",
      "not-an-ip",
    ];
    for (const ip of privateOrReserved) {
      it(`treats "${ip}" as private/reserved`, () => {
        expect(isPrivateOrReservedIp(ip)).toBe(true);
      });
    }

    const publicIps = ["8.8.8.8", "1.1.1.1", "203.0.114.5", "2a00:1450:4001::1"];
    for (const ip of publicIps) {
      it(`treats "${ip}" as public`, () => {
        expect(isPrivateOrReservedIp(ip)).toBe(false);
      });
    }
  });

  describe("mapCityResponse", () => {
    it("maps country.iso_code and city.names.en", () => {
      const loc = mapCityResponse({
        country: { iso_code: "SE" },
        city: { names: { en: "Stockholm" } },
      } as any);
      expect(loc).toEqual({ country: "SE", city: "Stockholm" });
    });

    it("returns undefined when neither field is present", () => {
      expect(mapCityResponse({} as any)).toBeUndefined();
      expect(mapCityResponse(null)).toBeUndefined();
    });

    it("returns only the country when the city is absent", () => {
      const loc = mapCityResponse({ country: { iso_code: "SE" } } as any);
      expect(loc).toEqual({ country: "SE" });
    });
  });

  describe("parseTrustProxyEnv", () => {
    it("defaults to false when unset or empty", () => {
      expect(parseTrustProxyEnv(undefined)).toBe(false);
      expect(parseTrustProxyEnv("")).toBe(false);
      expect(parseTrustProxyEnv("   ")).toBe(false);
    });
    it("parses boolean strings", () => {
      expect(parseTrustProxyEnv("true")).toBe(true);
      expect(parseTrustProxyEnv("false")).toBe(false);
    });
    it("parses an integer hop count", () => {
      expect(parseTrustProxyEnv("2")).toBe(2);
    });
    it("parses a comma-separated IP/CIDR allow-list", () => {
      expect(parseTrustProxyEnv("10.0.0.0/8, 192.168.0.0/16")).toEqual([
        "10.0.0.0/8",
        "192.168.0.0/16",
      ]);
    });
  });

  describe("X-Forwarded-For extraction with trustProxy", () => {
    it("resolves request.ip to the left-most client in the XFF chain", async () => {
      // A standalone Fastify instance configured exactly as the service is when
      // TRUST_PROXY=true, with a route that echoes the resolved client IP.
      const app = require("fastify")({ trustProxy: parseTrustProxyEnv("true") });
      app.get("/ip", (request: any, reply: any) => {
        reply.send({ ip: request.ip });
      });

      const response = await app.inject({
        method: "GET",
        url: "/ip",
        headers: {
          "x-forwarded-for": "203.0.114.7, 70.41.3.18, 150.172.238.178",
        },
      });

      expect(JSON.parse(response.body).ip).toBe("203.0.114.7");
      await app.close();
    });

    it("ignores X-Forwarded-For when trustProxy is off (default)", async () => {
      const app = require("fastify")({
        trustProxy: parseTrustProxyEnv(undefined),
      });
      app.get("/ip", (request: any, reply: any) => {
        reply.send({ ip: request.ip });
      });

      const response = await app.inject({
        method: "GET",
        url: "/ip",
        headers: { "x-forwarded-for": "203.0.114.7" },
      });

      // The spoofed header is not trusted, so request.ip is NOT the XFF value.
      expect(JSON.parse(response.body).ip).not.toBe("203.0.114.7");
      await app.close();
    });
  });
});
