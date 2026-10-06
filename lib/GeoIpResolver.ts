import * as fs from "fs";
import { Reader, CityResponse } from "mmdb-lib";
import winston from "winston";

/**
 * Coarse geo-location derived from a client IP address. Both fields are
 * optional: a lookup may resolve a country but not a city (or neither), in
 * which case the absent field is omitted entirely rather than emptied.
 */
export interface GeoLocation {
  /** ISO 3166-1 alpha-2 country code, e.g. "SE". */
  country?: string;
  /** City name (English). */
  city?: string;
}

/**
 * Resolves a client IP to a coarse {@link GeoLocation}. Deliberately tiny so it
 * can be mocked in tests without a real database file. A `lookup` that cannot
 * resolve the address returns `undefined` so the caller omits the fields.
 */
export interface GeoIpResolver {
  lookup(ip: string): GeoLocation | undefined;
}

/**
 * Whether geo enrichment is switched on. Opt-in: off unless `GEOIP_ENABLED` is
 * exactly "true", so no deployment starts resolving IPs until an operator
 * enables it.
 */
export function isGeoIpEnabled(): boolean {
  return process.env.GEOIP_ENABLED === "true";
}

/**
 * Map a raw database response to a {@link GeoLocation}, keeping only the coarse
 * country/city fields. Extracted as a pure function so the mapping is unit
 * testable without opening a real database. Returns `undefined` when neither
 * field is present, so the caller omits both.
 */
export function mapCityResponse(
  response: CityResponse | null | undefined,
): GeoLocation | undefined {
  if (!response) {
    return undefined;
  }
  const country = response.country?.iso_code;
  const city = response.city?.names?.en;
  if (!country && !city) {
    return undefined;
  }
  const location: GeoLocation = {};
  if (country) {
    location.country = country;
  }
  if (city) {
    location.city = city;
  }
  return location;
}

/**
 * Is this address one that must never be looked up or forwarded — private,
 * loopback, link-local, unique-local, carrier-grade NAT, documentation/test, or
 * otherwise reserved/non-public? On any such (or unparseable) address the geo
 * fields are omitted entirely, mirroring the `domain` contract.
 */
export function isPrivateOrReservedIp(ip: string | undefined | null): boolean {
  if (!ip) {
    return true;
  }
  let addr = ip.trim();
  // Strip an IPv6 zone id, e.g. "fe80::1%eth0".
  const zoneIdx = addr.indexOf("%");
  if (zoneIdx !== -1) {
    addr = addr.slice(0, zoneIdx);
  }
  // Unwrap an IPv4-mapped IPv6 address, e.g. "::ffff:192.168.0.1".
  const mapped = addr.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) {
    addr = mapped[1];
  }

  if (addr.indexOf(".") !== -1 && addr.indexOf(":") === -1) {
    return isPrivateOrReservedIpv4(addr);
  }
  return isPrivateOrReservedIpv6(addr);
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (
    parts.length !== 4 ||
    parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
  ) {
    return true; // Not a valid public IPv4 address.
  }
  const [a, b, c] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 IETF protocol
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 TEST-NET-3
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + broadcast
  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const addr = ip.toLowerCase();
  if (addr.indexOf(":") === -1) {
    return true; // Not an IPv6 address.
  }
  if (addr === "::1") return true; // loopback
  if (addr === "::") return true; // unspecified
  // fe80::/10 link-local (fe8_, fe9_, fea_, feb_).
  if (/^fe[89ab]/.test(addr)) return true;
  // fc00::/7 unique local.
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true;
  // ff00::/8 multicast.
  if (addr.startsWith("ff")) return true;
  return false;
}

/**
 * {@link GeoIpResolver} backed by a local MMDB-format database file read from
 * disk. The lookup is fully in-process: the IP never leaves the service.
 */
export class MmdbGeoIpResolver implements GeoIpResolver {
  private reader: Reader<CityResponse>;
  private logger: winston.Logger;

  constructor(dbPath: string, logger: winston.Logger) {
    this.logger = logger;
    const buffer = fs.readFileSync(dbPath);
    this.reader = new Reader<CityResponse>(buffer);
  }

  lookup(ip: string): GeoLocation | undefined {
    let result: CityResponse | null;
    try {
      result = this.reader.get(ip);
    } catch (err) {
      // Never log the address itself. A malformed address just yields no geo.
      this.logger.debug(
        `Geo-IP lookup failed for an address: ${(err as Error).message}`,
      );
      return undefined;
    }
    return mapCityResponse(result);
  }
}

/**
 * Build the resolver from configuration, or return `undefined` when geo
 * enrichment is disabled or cannot be initialised. Never throws: a missing or
 * unreadable database degrades gracefully to "no enrichment" rather than
 * failing ingest.
 */
export function createGeoIpResolver(
  logger: winston.Logger,
): GeoIpResolver | undefined {
  if (!isGeoIpEnabled()) {
    return undefined;
  }
  const dbPath = process.env.GEOIP_DB_PATH;
  if (!dbPath) {
    logger.warn(
      "GEOIP_ENABLED is set but GEOIP_DB_PATH is not configured; geo enrichment disabled.",
    );
    return undefined;
  }
  try {
    const resolver = new MmdbGeoIpResolver(dbPath, logger);
    logger.info("Geo-IP enrichment enabled.");
    return resolver;
  } catch (err) {
    logger.error(
      `Failed to load the geo-IP database from the configured path; geo enrichment disabled: ${(err as Error).message}`,
    );
    return undefined;
  }
}
