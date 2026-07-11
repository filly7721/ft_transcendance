import { IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Body for `PATCH /users/me` (update the authenticated user's profile).
 *
 * All fields are optional — only the provided fields are updated. The
 * avatar is NOT updated here (use `POST /users/me/avatar` for file upload);
 * `avatarUrl` is included only for the rare case of setting an external URL.
 *
 * `login` is the searchable username. Changing it checks uniqueness; the
 * old login will no longer find the user, and the new login will.
 */
export class UpdateProfileDto {
  /** Display name shown in the UI. 3-20 chars. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  displayName?: string;

  /** Login (username). 3-20 chars, letters/digits/_- only. Must be unique. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'login may only contain letters, digits, _ and -',
  })
  login?: string;

  /** Avatar URL (external). Usually set via POST /users/me/avatar instead. */
  @IsOptional()
  @IsString()
  @IsUrl()
  avatarUrl?: string;
}
