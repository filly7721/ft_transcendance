import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protects routes with JWT auth.
 *
 * Delegates to the passport strategy registered under the name `'jwt'`
 * (see JwtStrategy). On failure it throws UnauthorizedException
 * automatically (HTTP 401).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
