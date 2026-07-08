import { plainToInstance } from 'class-transformer';
import { IsInt, IsString, Min, validateSync } from 'class-validator';

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

  /** Symmetric key used to sign JWTs. Must be set. */
  @IsString()
  JWT_SECRET: string;

  /** JWT expiry as an `ms`-compatible string (e.g. "7d", "1h", "3600s"). */
  @IsString()
  JWT_EXPIRES_IN: string = '7d';

  /** Allowed frontend origin for CORS. */
  @IsString()
  CORS_ORIGIN: string = 'http://localhost:3000';
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
  return validated;
}
