import * as crypto from 'crypto';
import type { CallableRequest, Request } from 'firebase-functions/v2/https';

export interface RequestAuditMeta {
  source: 'callable' | 'http';
  ipAddress?: string;
  ipHash?: string;
  userAgent?: string;
}

function hashIp(ip: string): string {
  // Shortened hash keeps logs useful for correlation without storing raw IPs.
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function normalizeHeader(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) {
    return v[0];
  }
  return v;
}

function getIp(req: Request): string | undefined {
  const xff = normalizeHeader(req.headers['x-forwarded-for']);
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) {
      return first;
    }
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
    ipHash: ip ? hashIp(ip) : undefined,
    userAgent: userAgent ? userAgent.slice(0, 256) : undefined,
  };
}

export function requestMetaFromCallable(request: CallableRequest): RequestAuditMeta {
  const base = requestMetaFromHttp(request.rawRequest);
  return { ...base, source: 'callable' };
}
