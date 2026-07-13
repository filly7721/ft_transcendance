import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeysService, type ApiKeyOwner } from '../api-keys.service';

/** Header the public API reads the key from. */
export const API_KEY_HEADER = 'x-api-key';

/** The request shape this guard produces. `user` deliberately mirrors what
 *  JwtAuthGuard attaches, so `@CurrentUser()` works on API-key routes too. */
export interface ApiKeyRequest extends Request {
  user?: ApiKeyOwner;
  apiKeyOwnerId?: string;
}

/**
 * Authenticates public-API requests with an `X-API-Key` header.
 *
 * The key is resolved to its owner and attached to the request as `user`, in
 * the same `{ id, login }` shape the JWT strategy uses — so a controller can
 * take `@CurrentUser()` without caring which credential got the caller in.
 *
 * A missing, unknown, or revoked key is a flat 401. The response never says
 * which of the three it was: distinguishing "no such key" from "revoked key"
 * would confirm that a guessed key once existed.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();

    const header = request.headers[API_KEY_HEADER];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw) {
      throw new UnauthorizedException(
        `missing ${API_KEY_HEADER} header — mint a key at POST /api/keys`,
      );
    }

    const owner = await this.apiKeys.verify(raw);
    if (!owner) {
      throw new UnauthorizedException('invalid or revoked api key');
    }

    request.user = owner;
    // The per-key throttler buckets on this instead of the IP, so one key's
    // traffic cannot exhaust another caller's budget from a shared NAT.
    request.apiKeyOwnerId = owner.id;
    return true;
  }
}
