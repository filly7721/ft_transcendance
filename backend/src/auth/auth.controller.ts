import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DevTokenDto } from './dto/dev-token.dto';

/**
 * Dev-only token issuer.
 *
 * `POST /auth/dev-token` body `{ login }` → `{ accessToken }`.
 *
 * SECURITY: This endpoint is GATED by `NODE_ENV !== 'production'`. In
 * production it throws 404. It exists so the WS auth (C1 fix) can be
 * smoke-tested without standing up the full register/login flow from the
 * auth branch. The issued JWT has a random UUID `sub` (non-enumerable)
 * and the provided `login`.
 *
 * In a full deployment, the frontend would get its JWT from
 * `POST /auth/login` (from the auth branch) and pass it to the WS gateway
 * via `io(..., { auth: { token } })`.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly jwt: JwtService) {}

  @Post('dev-token')
  @HttpCode(200)
  devToken(@Body() dto: DevTokenDto): { accessToken: string } {
    if (process.env.NODE_ENV === 'production') {
      // Hard block in prod — this endpoint must never be reachable.
      throw new Error('dev-token endpoint is disabled in production');
    }
    const sub = crypto.randomUUID();
    const accessToken = this.jwt.sign({ sub, login: dto.login });
    return { accessToken };
  }
}
