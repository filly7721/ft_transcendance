import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MinesweeperGateway } from './minesweeper.gateway';

/**
 * Minesweeper feature module.
 *
 * Imports AuthModule for JwtService (WS auth on connect) and WsRateLimiter
 * (per-IP connection cap) — the same wiring as SuperTttModule.
 */
@Module({
  imports: [AuthModule],
  providers: [MinesweeperGateway],
})
export class MinesweeperModule {}
