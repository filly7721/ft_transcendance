import { Module } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module';
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
 * Imports `FriendsModule` for `FriendsService`: blocks decide which lobbies a
 * caller may see and join, and that rule lives with the rest of the block
 * semantics rather than being re-queried here. Not a cycle — FriendsModule
 * does not import this one.
 *
 * Exports `LobbiesService` so a future `GamesModule` (live game sessions over
 * WebSocket) can resolve lobbies without reaching into this module's files.
 */
@Module({
  imports: [FriendsModule],
  controllers: [LobbiesController],
  providers: [LobbiesService],
  exports: [LobbiesService],
})
export class LobbiesModule {}
