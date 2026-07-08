import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Body for `POST /auth/register`.
 *
 * Validation rules:
 * - email:    valid email format.
 * - login:    3-20 chars, only letters / numbers / underscore / hyphen.
 * - password: 8-72 chars (bcrypt truncates at 72 bytes), must contain at
 *             least one lowercase letter, one uppercase letter and one digit.
 */
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'login can only contain letters, numbers, underscores and hyphens',
  })
  login!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'password must contain at least one lowercase letter, one uppercase letter and one digit',
  })
  password!: string;
}
