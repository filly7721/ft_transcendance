import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SocialModule } from '../social/social.module';
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
 *   - PresenceService: to track online status
 *   - WsRateLimiter: to cap concurrent connections per IP
 *   - SocialGateway: to broadcast presence changes. A /chat connection makes
 *     its user online, but only /social clients listen for presence — so the
 *     broadcast is delegated there instead of duplicated on this namespace.
 *     Not a cycle: SocialModule does not import ChatModule.
 */
@Module({
  imports: [AuthModule, SocialModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
