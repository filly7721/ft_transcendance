import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ApiKeyRequest } from './api-key.guard';

/**
 * Rate limiter for the public API, bucketed **per API key** rather than per IP.
 *
 * The default ThrottlerGuard tracks by IP, which is wrong for a public API:
 * two integrators behind the same corporate NAT would share (and exhaust) one
 * budget, while a single caller could sidestep the limit by rotating IPs. The
 * key is the identity that matters here, so that is what we count.
 *
 * Falls back to the IP when no key resolved — that only happens if this guard
 * somehow runs before ApiKeyGuard, and an unauthenticated request should still
 * be counted against something rather than nothing.
 */
@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: ApiKeyRequest): Promise<string> {
    const owner = req.apiKeyOwnerId;
    return Promise.resolve(owner ? `key:${owner}` : `ip:${req.ip ?? 'unknown'}`);
  }
}
