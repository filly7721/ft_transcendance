import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UsersService } from '../../users/users.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

/** Re-exported so existing imports keep working. */
export type JwtAuthenticatedUser = AuthenticatedUser;

/**
 * Passport-JWT strategy.
 *
 * - Extracts the token from the `Authorization: Bearer <token>` header.
 * - Verifies the signature with `JWT_SECRET` and checks the expiry.
 * - On success, `validate()` runs and its return value is attached to
 *   `req.user` (and is therefore available to controllers/guards).
 *
 * `validate()` loads the account rather than trusting the payload alone. A
 * JWT is stateless, so without this a deleted account's token stayed valid
 * on every route that never looked the user up — for the whole expiry
 * window (7 days by default). The lookup also means `login` is read fresh
 * from the row, so a renamed user is never carried under their old name.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      // Fail fast at startup: signing/verifying would silently break otherwise.
      throw new Error(
        'JWT_SECRET is not set. Add it to your .env file (see .env.example).',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('account no longer exists');
    }
    return { id: user.id, login: user.login };
  }
}
