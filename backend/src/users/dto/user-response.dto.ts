import { IsDateString, IsInt, IsString } from 'class-validator';

/**
 * Public user representation returned by every endpoint that exposes a user.
 *
 * Mirrors the `publicUserSelect` shape (see `users.service.ts`) expressed as a
 * class so it can be reused with `ClassSerializerInterceptor` / OpenAPI later.
 *
 * `passwordHash` is structurally absent — it can never be serialized over HTTP.
 */
export class UserResponseDto {
  @IsInt()
  id!: number;

  @IsString()
  email!: string;

  @IsString()
  login!: string;

  @IsString()
  displayName!: string;

  @IsDateString()
  createdAt!: Date;

  @IsDateString()
  updatedAt!: Date;
}
