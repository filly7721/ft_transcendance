import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MinesweeperModule } from './minesweeper/minesweeper.module';
import { SuperTttModule } from './superttt/superttt.module';

/**
 * Root application module.
 *
 * - ConfigModule: global env access.
 * - ThrottlerModule: global HTTP rate limiting (C2 for the HTTP surface —
 *   the /auth/dev-token endpoint and any future REST routes). The WS
 *   gateways use WsRateLimiter from AuthModule for socket-level limiting.
 * - AuthModule: JwtModule + WsRateLimiter + dev-token controller.
 * - MinesweeperModule + SuperTttModule: the two WS game gateways.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: 60 }, // 60 HTTP requests / min / IP
    ]),
    AuthModule,
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
