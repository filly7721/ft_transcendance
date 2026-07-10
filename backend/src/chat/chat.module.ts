import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

/**
 * Chat feature module.
 *
 * Imports AuthModule for:
 *   - JwtService (C1: WS auth — verifies tokens on chat gateway connection)
 *   - WsRateLimiter (C2: per-IP connection cap, shared singleton)
 *
 * Depends on the global `PrismaModule` and `PresenceModule` (both @Global).
 *
 * The ChatGateway uses:
 *   - JwtService: to verify tokens on WS connection
 *   - ChatService: to persist messages and fetch history
 *   - PresenceService: to track online status and broadcast presence updates
 *   - WsRateLimiter: to cap concurrent connections per IP
 */
@Module({
  imports: [AuthModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
