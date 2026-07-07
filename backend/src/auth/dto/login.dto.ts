import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * Body for `POST /auth/login`.
 *
 * The password only needs a minimal length check here: the real validation is
 * the bcrypt comparison against the stored hash. Email format is still checked
 * so we fail fast on obviously bad input.
 */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
