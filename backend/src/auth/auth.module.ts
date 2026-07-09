import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type ms from 'ms';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { WsRateLimiter } from '../common/ws-auth';

/**
 * Auth module.
 *
 * Wires:
 * - UsersModule (for DB access to the User table).
 * - PassportModule with the default strategy set to 'jwt'.
 * - JwtModule configured asynchronously from the ConfigService so the secret
 *   and the expiry are read from the environment (never hardcoded).
 * - WsRateLimiter: shared singleton so the per-IP WebSocket connection cap
 *   is global across all game gateways.
 *
 * Exports JwtModule so the game gateways can verify tokens on WS connections.
 */
@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // `expiresIn` is typed as `number | StringValue` by jsonwebtoken (a
      // branded template-literal type). The value comes from the env as a
      // plain string, so we cast it to `ms.StringValue` to satisfy the type
      // without loosening it to `any`.
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '7d') as ms.StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, WsRateLimiter],
  exports: [AuthService, JwtModule, WsRateLimiter],
})
export class AuthModule {}
