import { IsDateString, IsOptional, IsString, IsUrl } from 'class-validator';

/**
 * Public user representation returned by every endpoint that exposes a user.
 *
 * Mirrors the `publicUserSelect` shape (see `users.service.ts`) expressed as a
 * class so it can be reused with `ClassSerializerInterceptor` / OpenAPI later.
 *
 * `passwordHash` is structurally absent — it can never be serialized over HTTP.
 * `id` is a UUID string (non-enumerable).
 * `avatarUrl` is nullable (null = use default avatar).
 */
export class UserResponseDto {
  @IsString()
  id!: string;

  @IsString()
  email!: string;

  @IsString()
  login!: string;

  @IsString()
  displayName!: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  avatarUrl?: string | null;

  @IsDateString()
  createdAt!: Date;

  @IsDateString()
  updatedAt!: Date;
}
