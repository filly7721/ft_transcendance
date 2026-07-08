import { Injectable } from '@nestjs/common';
import { Prisma, User, PasswordResetToken } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Central definition of the "safe to expose" user shape.
 *
 * `passwordHash` is never selected by any public lookup, so it can never leak
 * over HTTP. Services that genuinely need the hash (auth login / delete) use
 * the explicit `*WithHash` methods below.
 */
export const publicUserSelect = {
  id: true,
  email: true,
  login: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

/** Public user shape — every field in `publicUserSelect`, no `passwordHash`. */
export type SafeUser = Omit<User, 'passwordHash'>;

/**
 * Data-access layer for the User table (and its password-reset tokens).
 *
 * Only exposes what the auth feature (and a guarded `/users/me`) needs.
 * Avatar upload, friends, roles, ELO, etc. are out of scope here and must be
 * implemented by the teammate responsible for the "User Management" module.
 *
 * Note: service methods return the full entity (including `passwordHash`).
 * It is the responsibility of the caller (AuthService / controller) to strip
 * `passwordHash` before sending anything to the client.
 *
 * User IDs are UUID strings (non-enumerable). All `id` / `userId` parameters
 * in this service are typed as `string`.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Find a user by its unique email (public shape, no passwordHash). */
  findByEmail(email: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: publicUserSelect,
    });
  }

  /** Find a user by its unique login (public shape, no passwordHash). */
  findByLogin(login: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { login },
      select: publicUserSelect,
    });
  }

  /** Find a user by id (public shape, no passwordHash). Returns null if not found. */
  findById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
  }

  /** Returns a user if either the email OR the login is already taken. */
  findByEmailOrLogin(email: string, login: string): Promise<SafeUser | null> {
    return this.prisma.user.findFirst({
      where: { OR: [{ email }, { login }] },
      select: publicUserSelect,
    });
  }

  // ----- Internal: hash-bearing lookups (auth only) -----------------------
  // The ONLY methods that return `passwordHash`. Used exclusively by
  // AuthService for bcrypt comparison (login, deleteAccount). Never expose
  // their result over HTTP — the caller must strip the hash.

  /** Find a user by email INCLUDING the passwordHash. Auth-internal only. */
  findByEmailWithHash(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** Find a user by id INCLUDING the passwordHash. Auth-internal only. */
  findByIdWithHash(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Create a new user. `data.passwordHash` must already be hashed. */
  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  /** Update a user's password hash. `passwordHash` must already be hashed. */
  updatePassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  /** Delete a user by id. Cascades to their password-reset tokens. */
  delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }

  // ----- Password-reset tokens -------------------------------------------

  /** Create a reset-token row. `tokenHash` must already be hashed (SHA-256). */
  createResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  /** Find a non-expired, unused reset token by its hash. Null if not found. */
  findValidResetToken(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
  }

  /** Mark a reset token as used (single-use enforcement). */
  markResetTokenUsed(id: number): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  /** Delete all expired tokens for a user (housekeeping). */
  deleteExpiredResetTokens(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.passwordResetToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
  }
}
