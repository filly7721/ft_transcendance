import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
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
 * Public user shape returned by every auth response.
 * `passwordHash` is stripped here and can never leak to the client.
 */
export type SafeUser = Omit<
  Awaited<ReturnType<UsersService['findById']>>,
  'passwordHash'
>;

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
    const user = await this.users.findByEmail(dto.email);
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

  /** Sign a JWT for the given user. */
  private async signTokenFor(userId: number, login: string): Promise<string> {
    const payload: JwtPayload = { sub: userId, login };
    return this.jwt.signAsync(payload);
  }

  /** Remove `passwordHash` from a user entity. */
  private stripPassword(user: {
    id: number;
    email: string;
    login: string;
    displayName: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
  }): SafeUser {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }
}
