import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LobbiesModule } from '../lobbies/lobbies.module';
import { MinesweeperGateway } from './minesweeper.gateway';

/**
 * Minesweeper feature module.
 *
 * Imports AuthModule for JwtService (WS auth on connect) and WsRateLimiter
 * (per-IP connection cap) — the same wiring as SuperTttModule — plus
 * LobbiesModule so the gateway can sync lobby rows with live rooms.
 */
@Module({
  imports: [AuthModule, LobbiesModule],
  providers: [MinesweeperGateway],
})
export class MinesweeperModule {}
