import { IsEmail } from 'class-validator';

/**
 * Body for `POST /auth/forgot-password`.
 *
 * Only the email is needed. The endpoint ALWAYS returns 200 (even if no
 * account exists for that email) to prevent user enumeration.
 */
export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}
