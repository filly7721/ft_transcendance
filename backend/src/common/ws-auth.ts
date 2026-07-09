import { Injectable, Logger } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

/**
 * Per-IP WebSocket connection limiter (C2 fix).
 *
 * Caps concurrent WS connections per IP address to prevent connection-flood
 * DoS. Injected into both game gateways; called in `handleConnection`
 * before seating and in `handleDisconnect` to release.
 *
 * Default limit: 5 concurrent connections per IP. A human playing 2 games
 * (minesweeper + superttt) + a spectator tab = 3; 5 is comfortable headroom.
 */
@Injectable()
export class WsRateLimiter {
  private readonly logger = new Logger(WsRateLimiter.name);
  private readonly counts = new Map<string, number>();
  private readonly maxPerIp: number = 5;

  /**
   * Try to acquire a connection slot for the given IP.
   * Returns true if allowed, false if the IP is over the limit.
   */
  tryAcquire(ip: string): boolean {
    const current = this.counts.get(ip) ?? 0;
    if (current >= this.maxPerIp) {
      this.logger.warn(
        `rejecting connection from ${ip}: ${current}/${this.maxPerIp} already active`,
      );
      return false;
    }
    this.counts.set(ip, current + 1);
    return true;
  }

  /** Release a connection slot (on disconnect). */
  release(ip: string): void {
    const current = this.counts.get(ip) ?? 0;
    if (current <= 1) {
      this.counts.delete(ip);
    } else {
      this.counts.set(ip, current - 1);
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

/** Extract the client IP from a socket, accounting for proxies. */
export function getSocketIp(client: Socket): string {
  const xff = client.handshake.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return client.handshake.address ?? 'unknown';
}
