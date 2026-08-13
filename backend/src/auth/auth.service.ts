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
    userId: string,
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
  private async signTokenFor(userId: string, login: string): Promise<string> {
    const payload: JwtPayload = { sub: userId, login };
    return this.jwt.signAsync(payload);
  }

  /** Remove `passwordHash` from a full user entity (auth-internal inputs). */
  private stripPassword(user: User): SafeUser {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }
}
