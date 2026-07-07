import { Injectable } from '@nestjs/common';
import { Prisma, User, PasswordResetToken } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Find a user by its unique email. Returns null if not found. */
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** Find a user by its unique login. Returns null if not found. */
  findByLogin(login: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { login } });
  }

  /** Find a user by id. Returns null if not found. */
  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Returns a user if either the email OR the login is already taken. */
  findByEmailOrLogin(email: string, login: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { OR: [{ email }, { login }] },
    });
  }

  /** Create a new user. `data.passwordHash` must already be hashed. */
  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  /** Update a user's password hash. `passwordHash` must already be hashed. */
  updatePassword(id: number, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  /** Delete a user by id. Cascades to their password-reset tokens. */
  delete(id: number): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }

  // ----- Password-reset tokens -------------------------------------------

  /** Create a reset-token row. `tokenHash` must already be hashed (SHA-256). */
  createResetToken(
    userId: number,
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
  deleteExpiredResetTokens(userId: number): Promise<Prisma.BatchPayload> {
    return this.prisma.passwordResetToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
  }
}
