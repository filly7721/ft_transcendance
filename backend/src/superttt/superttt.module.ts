import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SuperTttGateway } from './superttt.gateway';

/**
 * Super Tic-Tac-Toe feature module.
 *
 * Imports AuthModule for JwtService (C1: WS auth) and WsRateLimiter (C2:
 * per-IP connection cap). The game rules live in the pure SuperTttEngine.
 */
@Module({
  imports: [AuthModule],
  providers: [SuperTttGateway],
})
export class SuperTttModule {}
