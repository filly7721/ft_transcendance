import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';

/**
 * Root application module.
 *
 * Module order is intentional:
 *  - ConfigModule: global env access (already present in the scaffold).
 *  - ThrottlerModule: global rate limiting; the AuthController narrows the
 *    limits on /auth/register and /auth/login.
 *  - PrismaModule: global DB access.
 *  - UsersModule + AuthModule: the auth feature.
 *
 * The ThrottlerGuard is registered as an APP_GUARD so every route is
 * rate-limited by default; specific routes override the limit with @Throttle.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: 60 }, // global default: 60 requests / min / IP
    ]),
    PrismaModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
