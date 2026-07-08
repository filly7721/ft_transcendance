import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
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
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly config: ConfigService) {
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
    return { id: payload.sub, login: payload.login };
  }
}
