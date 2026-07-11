import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LobbiesModule } from '../lobbies/lobbies.module';
import { SuperTttGateway } from './superttt.gateway';

/**
 * Super Tic-Tac-Toe feature module.
 *
 * Imports AuthModule for JwtService (C1: WS auth) and WsRateLimiter (C2:
 * per-IP connection cap), plus LobbiesModule so the gateway can sync lobby
 * rows with live rooms. The game rules live in the pure SuperTttEngine.
 */
@Module({
  imports: [AuthModule, LobbiesModule],
  providers: [SuperTttGateway],
})
export class SuperTttModule {}
