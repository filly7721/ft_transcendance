import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/**
 * Auth endpoints.
 *
 * - `POST /auth/register` -> create an account, returns { user, accessToken }.
 * - `POST /auth/login`    -> log in, returns { user, accessToken }.
 *
 * Both routes are rate-limited to mitigate brute-force / abuse.
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
}
