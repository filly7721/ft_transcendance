import { plainToInstance } from 'class-transformer';
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  Min,
  validateSync,
} from 'class-validator';

/** The placeholder shipped in .env.example. Booting with it still set means
 *  the secret was never generated, so every JWT is signed with a value that
 *  is public in the repository. */
const PLACEHOLDER_SECRET = 'change_me_to_a_long_random_hex_string';

/**
 * Shape of the environment variables the app expects.
 *
 * Every variable listed here is validated once at startup (see `validateEnv`).
 * A missing or malformed required variable crashes the app immediately, before
 * it starts listening for requests — this is intentional: failing fast is far
 * better than discovering a missing JWT_SECRET on the first login attempt.
 *
 * Keep this in sync with `.env.example`.
 */
class EnvVars {
  /** HTTP port the Nest app listens on. */
  @IsInt()
  @Min(1)
  PORT: number = 3001;

  /** Node environment: "development" | "production" | "test". */
  @IsString()
  NODE_ENV: string = 'development';

  /** Prisma datasource URL (e.g. postgresql://user:pass@host:port/db). */
  @IsString()
  DATABASE_URL: string;

  /**
   * Symmetric key used to sign JWTs. Must be set, and must be long enough to
   * be worth signing with — `@IsString()` alone accepted "x". 32 characters
   * is the `openssl rand -hex 16` floor; .env.example suggests -hex 32.
   */
  @IsString()
  @MinLength(32, {
    message:
      'JWT_SECRET must be at least 32 characters — generate one with `openssl rand -hex 32`',
  })
  JWT_SECRET: string;

  /** JWT expiry as an `ms`-compatible string (e.g. "7d", "1h", "3600s"). */
  @IsString()
  JWT_EXPIRES_IN: string = '7d';

  /**
   * The origin the frontend is served from. The only place that URL is
   * configured: it is the allowed origin for both HTTP CORS and the websocket
   * gateways (see config/frontend-origin, which reads it).
   */
  @IsString()
  FRONTEND_URL: string = 'http://localhost:3000';

  /**
   * Whether to believe X-Forwarded-For when identifying a websocket client
   * (see common/ws-auth `getSocketIp`). Only true behind a proxy you control:
   * the header is client-controlled, so trusting it otherwise lets anyone
   * sidestep the per-IP connection cap with a random value per connection.
   *
   * Declared here so a typo like TRUST_PROXY=yes fails at boot rather than
   * silently reading as "not 'true'", i.e. off.
   */
  @IsOptional()
  @IsBooleanString({ message: 'TRUST_PROXY must be "true" or "false"' })
  TRUST_PROXY?: string;
}

/**
 * Validates the raw `process.env` against `EnvVars`.
 *
 * Used by `ConfigModule.forRoot({ validate })`. Returns the typed config on
 * success, throws on any validation error so the process exits at boot.
 */
export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${messages}`);
  }

  // Length alone does not catch the one bad secret we can name: the
  // placeholder from .env.example is 36 characters and would sail through.
  if (validated.JWT_SECRET === PLACEHOLDER_SECRET) {
    throw new Error(
      'JWT_SECRET is still the placeholder from .env.example. Generate a real ' +
        'one with `openssl rand -hex 32` — every token is signed with this.',
    );
  }

  return validated;
}
