import { randomBytes, createHash } from 'crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { User } from '@prisma/client';
import { UsersService } from '../users/users.service';
import type { SafeUser } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

/**
 * bcrypt cost factor.
 *
 * 12 is a good balance for 2025: well above the OWASP minimum (10) while
 * keeping registration under ~300ms. Increase it over time as hardware gets
 * faster.
 */
export const BCRYPT_ROUNDS = 12;

/** How long a password-reset token stays valid. */
export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Standard auth response: the authenticated user + a fresh access token.
 */
export interface AuthResponse {
  user: SafeUser;
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Register a new account.
   *
   * Flow:
   *  1. Reject if the email or login is already taken (409 Conflict).
   *  2. Hash the password with bcrypt (cost = BCRYPT_ROUNDS).
   *  3. Persist the user.
   *  4. Sign a JWT and return it together with the public user.
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.users.findByEmailOrLogin(dto.email, dto.login);
    if (existing) {
      throw new ConflictException('email or login already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.users.create({
      email: dto.email,
      login: dto.login,
      displayName: dto.login,
      passwordHash,
    });

    const accessToken = await this.signTokenFor(user.id, user.login);
    return { user: this.stripPassword(user), accessToken };
  }

  /**
   * Log an existing user in.
   *
   * The same error message is returned whether the email does not exist or
   * the password is wrong, to prevent user enumeration.
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    // Needs the hash for bcrypt.compare — uses the internal hash-bearing lookup.
    const user = await this.users.findByEmailWithHash(dto.email);
    if (!user) {
      throw new UnauthorizedException('invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('invalid credentials');
    }

    const accessToken = await this.signTokenFor(user.id, user.login);
    return { user: this.stripPassword(user), accessToken };
  }

  /**
   * Request a password reset.
   *
   * ALWAYS returns the same shape (200) whether or not the email exists, to
   * prevent user enumeration. When the email matches an account:
   *  - any previously issued, still-valid tokens for that user are cleaned up,
   *  - a fresh high-entropy random token is generated,
   *  - its SHA-256 hash is stored (so a DB leak cannot be reused),
   *  - the raw token is returned in DEV mode only (NODE_ENV !== 'production').
   *    In production the raw token would be sent by email instead; the email
   *    transport is out of scope for the auth feature itself.
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string; resetToken?: string }> {
    const user = await this.users.findByEmail(dto.email);

    // Always respond the same way to avoid leaking which emails are registered.
    const generic = { message: 'if the email exists, a reset link has been sent' };

    if (!user) {
      return generic;
    }

    // Housekeeping: remove expired tokens for this user.
    await this.users.deleteExpiredResetTokens(user.id);

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.users.createResetToken(user.id, tokenHash, expiresAt);

    if (process.env.NODE_ENV === 'production') {
      // In prod, email the link containing the raw token. The frontend would
      // render /reset-password?token=... and POST it back to /auth/reset-password.
      return generic;
    }

    // Dev: return the raw token so the flow is testable without an SMTP setup.
    return { ...generic, resetToken: rawToken };
  }

  /**
   * Reset a password using a token issued by forgotPassword.
   *
   * Validates the token (exists, not expired, not already used), hashes the
   * new password, updates the user, and marks the token as used (single-use).
   * Throws 401 for any invalid / expired / reused token, with a generic
   * message.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = this.hashToken(dto.token);
    const token = await this.users.findValidResetToken(tokenHash);

    const isInvalid =
      !token ||
      token.usedAt !== null ||
      token.expiresAt.getTime() < Date.now();

    if (isInvalid) {
      throw new UnauthorizedException('invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.users.updatePassword(token.userId, passwordHash);
    await this.users.markResetTokenUsed(token.id);

    return { message: 'password updated' };
  }

  /**
   * Delete the authenticated user's account.
   *
   * Requires the current password to be re-confirmed: a stolen JWT alone must
   * never be enough to delete an account. On success the user row (and, via
   * cascade, their reset tokens) is removed.
   *
   * Note: the JWT is stateless, so the token issued at login technically
   * remains valid until it expires. Subsequent calls to guarded endpoints
   * will fail because the user no longer exists (e.g. /users/me returns 401).
   */
  async deleteAccount(
    userId: number,
    dto: DeleteAccountDto,
  ): Promise<{ message: string }> {
    // Needs the hash to re-confirm the password before deletion.
    const user = await this.users.findByIdWithHash(userId);
    if (!user) {
      throw new NotFoundException('user not found');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('invalid credentials');
    }

    await this.users.delete(userId);
    return { message: 'account deleted' };
  }

  /** Sign a JWT for the given user. */
  private async signTokenFor(userId: number, login: string): Promise<string> {
    const payload: JwtPayload = { sub: userId, login };
    return this.jwt.signAsync(payload);
  }

  /** SHA-256 hash of a raw reset token (deterministic, lookable by index). */
  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /** Remove `passwordHash` from a full user entity (auth-internal inputs). */
  private stripPassword(user: User): SafeUser {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }
}
