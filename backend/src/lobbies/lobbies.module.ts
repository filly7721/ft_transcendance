import { Module } from '@nestjs/common';
import { LobbiesController } from './lobbies.controller';
import { LobbiesService } from './lobbies.service';

/**
 * Lobbies feature module.
 *
 * Depends on the global `PrismaModule` (no explicit import needed — it is
 * `@Global()`) and on `AuthModule`'s `JwtAuthGuard` (imported directly by the
 * controller, which is fine since the guard is just a class reference, not a
 * DI provider that needs to be in `imports`).
 *
 * Exports `LobbiesService` so a future `GamesModule` (live game sessions over
 * WebSocket) can resolve lobbies without reaching into this module's files.
 */
@Module({
  controllers: [LobbiesController],
  providers: [LobbiesService],
  exports: [LobbiesService],
})
export class LobbiesModule {}
