import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LobbiesModule } from './lobbies/lobbies.module';
import { ProfileModule } from './profile/profile.module';
import { MinesweeperModule } from './minesweeper/minesweeper.module';
import { SuperTttModule } from './superttt/superttt.module';
import { validateEnv } from './config/env.validation';

/**
 * Root application module.
 *
 * Module order is intentional:
 *  - ConfigModule: global env access (validates process.env at boot).
 *  - ThrottlerModule: global rate limiting; the AuthController and
 *    LobbiesController narrow the limits on specific routes. The WS
 *    gateways use WsRateLimiter from AuthModule for socket-level limiting.
 *  - PrismaModule: global DB access.
 *  - UsersModule + AuthModule: the auth feature.
 *  - LobbiesModule: the lobby-rooms feature.
 *  - MinesweeperModule + SuperTttModule: the two WS game gateways.
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
    LobbiesModule,
    ProfileModule,
    MinesweeperModule,
    SuperTttModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
