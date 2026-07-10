import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

/**
 * Body for `PATCH /users/me` (update the authenticated user's profile).
 *
 * All fields are optional — only the provided fields are updated. The
 * avatar is NOT updated here (use `POST /users/me/avatar` for file upload);
 * `avatarUrl` is included only for the rare case of setting an external URL.
 */
export class UpdateProfileDto {
  /** Display name shown in the UI. 3-20 chars. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  displayName?: string;

  /** Avatar URL (external). Usually set via POST /users/me/avatar instead. */
  @IsOptional()
  @IsString()
  @IsUrl()
  avatarUrl?: string;
}
