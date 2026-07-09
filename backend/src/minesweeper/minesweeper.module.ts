import { Module } from '@nestjs/common';
import { MinesweeperGateway } from './minesweeper.gateway';

@Module({
  providers: [MinesweeperGateway],
})
export class MinesweeperModule {}
