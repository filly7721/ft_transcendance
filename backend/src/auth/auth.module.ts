import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { WsRateLimiter } from '../common/ws-auth';

/**
 * Auth module.
 *
 * Configures JwtModule asynchronously from the ConfigService so the secret
 * and expiry are read from the environment (never hardcoded). Exposes:
 *   - JwtModule: so both game gateways can verify tokens on WS connections (C1).
 *   - WsRateLimiter: shared singleton so the per-IP cap is global across both
 *     gateways (C2).
 *
 * The dev-token controller is included for local testing; it self-disables
 * in production (throws if NODE_ENV === 'production').
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [WsRateLimiter],
  exports: [JwtModule, WsRateLimiter],
})
export class AuthModule {}
