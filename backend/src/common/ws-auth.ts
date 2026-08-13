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
 * Per-socket message rate limiter.
 *
 * `WsRateLimiter` above caps how many sockets an IP may OPEN; this caps what
 * a socket may send once it is open, which nothing did. ThrottlerGuard only
 * sees HTTP, so `POST /chat/:login` was capped at 30/min while the identical
 * `chat:send` over the socket was unbounded — and each `chat:typing` costs
 * two database queries. One connection could issue thousands a second.
 *
 * Fixed window per socket: cheap, and a window that lapses is replaced on the
 * next message rather than swept, so there is no timer to manage. Sockets are
 * dropped from the map by `forget()` on disconnect.
 *
 * Not a Nest provider — each gateway owns an instance sized to its own
 * traffic, since a minesweeper race and a chat thread are nothing alike.
 */
export class WsMessageLimiter {
  private readonly windows = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number = 60_000,
  ) {}

  /** Consume one message's budget. False means the socket is over its limit. */
  tryConsume(socketId: string): boolean {
    const now = Date.now();
    const window = this.windows.get(socketId);
    if (!window || now >= window.resetAt) {
      this.windows.set(socketId, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (window.count >= this.limit) return false;
    window.count++;
    return true;
  }

  /** Drop a socket's window on disconnect, so the map can't grow unbounded. */
  forget(socketId: string): void {
    this.windows.delete(socketId);
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
