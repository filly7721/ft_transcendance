import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * Body for `POST /auth/dev-token` (development only).
 *
 * Issues a JWT for the given login. The `sub` claim is a random UUID so
 * tokens are non-enumerable. This endpoint is disabled in production —
 * in prod, tokens come from the real auth service (register/login).
 */
export class DevTokenDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  login!: string;
}
