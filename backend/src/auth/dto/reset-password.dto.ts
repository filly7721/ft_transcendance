import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Body for `POST /auth/reset-password`.
 *
 * - `token`:       the raw reset token (as returned by forgot-password in
 *                  dev mode, or sent by email in prod).
 * - `newPassword`: must satisfy the same strength rules as registration.
 */
export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'password must contain at least one lowercase letter, one uppercase letter and one digit',
  })
  newPassword!: string;
}
