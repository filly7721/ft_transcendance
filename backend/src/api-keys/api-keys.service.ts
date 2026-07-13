import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/** Every raw key starts with this, so a leaked key is recognizable on sight
 *  (secret scanners key off prefixes like this) and so callers can tell an
 *  API key apart from a JWT at a glance. */
const KEY_PREFIX = 'arc_';
/** Bytes of entropy in the random part of the key. 32 bytes = 256 bits,
 *  well past guessable; rendered as 64 hex chars. */
const KEY_BYTES = 32;
/** How much of the raw key is stored in the clear for display purposes.
 *  "arc_" + 8 hex chars: enough to tell two keys apart in a list, far too
 *  little to reconstruct the other 56 characters from. */
const DISPLAY_PREFIX_LEN = KEY_PREFIX.length + 8;

/** A key as returned to its owner — never includes the secret. */
export interface ApiKeyResponse {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/** The one and only response that carries the raw key (creation time). */
export interface CreatedApiKeyResponse extends ApiKeyResponse {
  /** The secret. Shown ONCE — it is not recoverable afterwards. */
  key: string;
}

/** Who a valid key belongs to. Mirrors AuthenticatedUser so an API-key
 *  request and a JWT request look identical to controllers. */
export interface ApiKeyOwner {
  id: string;
  login: string;
}

/**
 * API keys for the public API (`/api/v1/*`).
 *
 * A key acts on behalf of the user who minted it: it can do exactly what its
 * owner can do, and nothing more. There is no separate permission model, so a
 * leaked key cannot escalate beyond one account.
 *
 * Storage follows the same rule as password-reset tokens: only the SHA-256
 * hash of the key is persisted, so a database leak yields nothing replayable.
 * SHA-256 (not bcrypt) is deliberate here — an API key is 256 bits of random,
 * not a low-entropy human password, so it is not brute-forceable and does not
 * need a slow hash. A slow hash would instead put ~100ms on EVERY API request.
 */
@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mint a new key for a user. Returns the raw key — the only time it exists
   * outside the caller's hands, since we store just its hash.
   */
  async create(userId: string, name: string): Promise<CreatedApiKeyResponse> {
    const raw = KEY_PREFIX + randomBytes(KEY_BYTES).toString('hex');
    const created = await this.prisma.apiKey.create({
      data: {
        userId,
        name,
        keyHash: this.hash(raw),
        prefix: raw.slice(0, DISPLAY_PREFIX_LEN),
      },
    });
    return { ...this.serialize(created), key: raw };
  }

  /** List a user's keys, newest first. Secrets are never included. */
  async list(userId: string): Promise<ApiKeyResponse[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((k) => this.serialize(k));
  }

  /**
   * Revoke a key. Scoped by userId so a caller can only revoke their own
   * keys — passing someone else's key id yields 404, not 403, so the endpoint
   * does not confirm that an id exists.
   *
   * The row is kept (revokedAt set, not deleted) so the prefix stays visible
   * in the owner's list as an audit trail of what was issued and withdrawn.
   */
  async revoke(userId: string, keyId: string): Promise<ApiKeyResponse> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });
    if (!key) {
      throw new NotFoundException('api key not found');
    }
    if (key.revokedAt) {
      return this.serialize(key); // already revoked — idempotent
    }
    const revoked = await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
    return this.serialize(revoked);
  }

  /**
   * Resolve a raw key to its owner, or null if the key is unknown or revoked.
   * Called by ApiKeyGuard on every public-API request.
   *
   * Also stamps `lastUsedAt`. That write is fire-and-forget: it must not add
   * latency to the request, and a lost timestamp is cosmetic.
   */
  async verify(raw: string): Promise<ApiKeyOwner | null> {
    if (!raw.startsWith(KEY_PREFIX)) return null;

    const record = await this.prisma.apiKey.findUnique({
      where: { keyHash: this.hash(raw) },
      include: { user: { select: { id: true, login: true } } },
    });
    if (!record || record.revokedAt) return null;

    void this.prisma.apiKey
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {
        // Cosmetic timestamp — never fail a request over it.
      });

    return { id: record.user.id, login: record.user.login };
  }

  // ----- internals --------------------------------------------------------

  /** SHA-256 of the raw key, hex-encoded. The only form we persist. */
  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Strip the hash (and everything else secret) from a row before it leaves. */
  private serialize(key: {
    id: string;
    name: string;
    prefix: string;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }): ApiKeyResponse {
    return {
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
      createdAt: key.createdAt,
    };
  }
}
