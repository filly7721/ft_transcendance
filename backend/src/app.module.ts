import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MinesweeperModule } from './minesweeper/minesweeper.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MinesweeperModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
