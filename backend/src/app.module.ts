import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MinesweeperModule } from './minesweeper/minesweeper.module';
import { SuperTttModule } from './superttt/superttt.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MinesweeperModule,
    SuperTttModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
