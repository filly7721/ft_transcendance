import { Module } from '@nestjs/common';
import { SuperTttGateway } from './superttt.gateway';

/**
 * Super Tic-Tac-Toe feature module.
 *
 * Registers the WebSocket gateway on the `super-tic-tac-toe` namespace.
 * Mirrors the minesweeper module structure: a thin module that just provides
 * the gateway. The game rules live in the pure `SuperTttEngine` class.
 */
@Module({
  providers: [SuperTttGateway],
})
export class SuperTttModule {}
