import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/** Shape of `req.user` after the JwtStrategy has validated the token. */
interface AuthenticatedRequest extends Request {
  user: { id: number; login: string };
}

/**
 * Auth endpoints.
 *
 * - `POST   /auth/register`        -> create an account, returns { user, accessToken }.
 * - `POST   /auth/login`           -> log in, returns { user, accessToken }.
 * - `POST   /auth/forgot-password` -> request a reset link (always 200).
 * - `POST   /auth/reset-password`  -> set a new password with a reset token.
 * - `DELETE /auth/account`         -> delete the current account (password required).
 *
 * All routes are rate-limited to mitigate brute-force / abuse.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 registrations / min / IP
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 logins / min / IP
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('forgot-password')
  @HttpCode(200) // action endpoint, not a resource creation
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 requests / min / IP
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(200) // action endpoint, not a resource creation
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 resets / min / IP
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 deletions / min / IP
  deleteAccount(@Req() req: AuthenticatedRequest, @Body() dto: DeleteAccountDto) {
    return this.auth.deleteAccount(req.user.id, dto);
  }
}
