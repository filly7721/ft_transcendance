import { IsString, MinLength } from 'class-validator';

/**
 * Body for `DELETE /auth/account`.
 *
 * The current password is required to confirm the deletion: a stolen JWT
 * alone must NOT be enough to delete an account.
 */
export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  password!: string;
}
