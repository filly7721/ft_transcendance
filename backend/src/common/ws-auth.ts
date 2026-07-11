import { Injectable, Logger } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

/**
 * Per-IP WebSocket connection limiter (C2 fix).
 *
 * Caps concurrent WS connections per IP address to prevent connection-flood
 * DoS. Injected into the gateways; called in `handleConnection` before
 * seating and in `handleDisconnect` to release.
 *
 * The limiter is a singleton shared by every gateway, so slots are scoped
 * per namespace: each gateway passes its namespace name and gets its own
 * per-IP pool. Without the scope, a user with the social + chat sockets a
 * normal page opens would eat the game gateways' budget too.
 *
 * Default limit: 5 concurrent connections per IP per namespace.
 */
@Injectable()
export class WsRateLimiter {
  private readonly logger = new Logger(WsRateLimiter.name);
  private readonly counts = new Map<string, number>();
  private readonly maxPerIp: number = 5;

  /**
   * Try to acquire a connection slot for the given IP in the given
   * namespace. Returns true if allowed, false if over the limit.
   */
  tryAcquire(namespace: string, ip: string): boolean {
    const key = `${namespace}:${ip}`;
    const current = this.counts.get(key) ?? 0;
    if (current >= this.maxPerIp) {
      this.logger.warn(
        `rejecting connection from ${ip} on ${namespace}: ${current}/${this.maxPerIp} already active`,
      );
      return false;
    }
    this.counts.set(key, current + 1);
    return true;
  }

  /** Release a connection slot (on disconnect). */
  release(namespace: string, ip: string): void {
    const key = `${namespace}:${ip}`;
    const current = this.counts.get(key) ?? 0;
    if (current <= 1) {
      this.counts.delete(key);
    } else {
      this.counts.set(key, current - 1);
    }
  }
}

/**
 * Extracts and verifies the JWT from a socket handshake (C1 fix).
 *
 * The token is expected in either:
 *   - `handshake.auth.token` (recommended — set via `io(url, { auth: { token } })`)
 *   - `handshake.query.token` (fallback — set via `io(url, { query: { token } })`)
 *
 * Returns the decoded payload `{ sub, login }` on success, or `null` on
 * failure (missing, malformed, expired, or invalid signature).
 */
export async function verifyWsToken(
  client: Socket,
  jwt: JwtService,
): Promise<{ sub: string; login: string } | null> {
  const raw =
    (client.handshake.auth as { token?: unknown } | undefined)?.token ??
    client.handshake.query.token;
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }
  try {
    const payload = await jwt.verifyAsync<{ sub: string; login: string }>(raw);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract the client IP from a socket.
 *
 * X-Forwarded-For is client-controlled, so trusting it unconditionally lets
 * anyone bypass the per-IP cap (and grow the limiter map without bound) by
 * sending a random header per connection. It is only honored when the app
 * is explicitly deployed behind a trusted reverse proxy (TRUST_PROXY=true);
 * otherwise the TCP peer address is used.
 */
export function getSocketIp(client: Socket): string {
  if (process.env.TRUST_PROXY === 'true') {
    const xff = client.handshake.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      return xff.split(',')[0].trim();
    }
  }
  return client.handshake.address ?? 'unknown';
}
