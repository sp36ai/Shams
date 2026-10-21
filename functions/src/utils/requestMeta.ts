import type { CallableRequest, Request } from 'firebase-functions/v2/https';
import { keyedHash } from './keyedHash';

export interface RequestAuditMeta {
  source: 'callable' | 'http';
  ipAddress?: string;
  ipHash?: string;
  userAgent?: string;
}

function normalizeHeader(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) {
    return v[0];
  }
  return v;
}

/**
 * The trustworthy client IP out of a raw X-Forwarded-For header value.
 *
 * SECURITY: this used to return the FIRST entry — the one position in this
 * header ANY caller can set to an arbitrary value, since a client's own
 * X-Forwarded-For header is never stripped, only appended to. Every request
 * this app receives passes through Google's HTTPS Load Balancer / GFE (Cloud
 * Functions v2 runs on Cloud Run, which sits behind it), and GFE's own
 * documented behavior is to append exactly two entries to whatever arrived —
 * the client IP as GFE itself observed it on the TCP connection, then GFE's
 * own IP — producing `<...whatever the client sent...>,<GFE-observed-client-ip>,<GFE-ip>`.
 * The LAST entry is GFE's own IP, never the caller's. The SECOND-TO-LAST is
 * the one entry a caller cannot forge, because GFE appends it after
 * whatever the client already sent — that's the value this function now
 * trusts. Every entry before it, including position 0, is caller-supplied
 * and must not be used for rate-limiting or security audit logging: an
 * attacker sending a fresh X-Forwarded-For value on every request could
 * otherwise make each request land in its own rate-limit bucket
 * (razorpay.ts's checkIpRateLimit) and poison the ipHash trail every
 * securityEvents/auditLogs record depends on for correlating abuse.
 *
 * Falls back to the raw TCP peer when the header is absent or has fewer
 * than 2 entries (no proxy in front — the Firebase emulator, for one).
 *
 * Exported for direct testing.
 */
export function trustedClientIp(xffHeader: string | undefined): string | undefined {
  if (!xffHeader) {
    return undefined;
  }
  const parts = xffHeader
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  if (parts.length < 2) {
    return undefined;
  }
  return parts[parts.length - 2];
}

function getIp(req: Request): string | undefined {
  const xff = normalizeHeader(req.headers['x-forwarded-for']);
  const trusted = trustedClientIp(xff);
  if (trusted) {
    return trusted;
  }

  const direct = req.ip ?? req.socket.remoteAddress;
  return direct ? String(direct) : undefined;
}

export function requestMetaFromHttp(req: Request): RequestAuditMeta {
  const ip = getIp(req);
  const userAgent = normalizeHeader(req.headers['user-agent'] as string | string[] | undefined);
  return {
    source: 'http',
    ipAddress: ip,
    // Keyed (utils/keyedHash.ts): an unsalted hash of an IP can be reversed
    // by enumerating every address. The raw `ipAddress` above is used only
    // in memory (razorpay.ts's per-IP rate limit) and is never stored.
    ipHash: ip ? keyedHash('ip', ip) : undefined,
    userAgent: userAgent ? userAgent.slice(0, 256) : undefined,
  };
}

export function requestMetaFromCallable(request: CallableRequest): RequestAuditMeta {
  const base = requestMetaFromHttp(request.rawRequest);
  return { ...base, source: 'callable' };
}
