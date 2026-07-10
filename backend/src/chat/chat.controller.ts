import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

/**
 * Chat REST endpoints (fallback for when WebSocket is unavailable).
 *
 * The primary real-time path is the WebSocket gateway (chat.gateway.ts).
 * These REST endpoints exist so the frontend can fetch initial state
 * (conversations, history) without a WS connection, and as a fallback
 * for sending messages if WS fails.
 *
 * All routes are JWT-guarded.
 *
 * - `GET  /chat/conversations`           -> list conversations + unread counts
 * - `GET  /chat/:login/history?cursor=N` -> paginated message history
 * - `POST /chat/:login`                  -> send a message (REST fallback)
 */
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  getConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.chat.getConversations(user.id);
  }

  @Get(':login/history')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('login') login: string,
    @Query('cursor') cursor?: string,
  ) {
    const cursorNum = cursor ? Number(cursor) : null;
    return this.chat.getHistory(user.id, login, cursorNum);
  }

  @Post(':login')
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // 30 msgs / min / IP
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('login') login: string,
    @Body() dto: Pick<SendMessageDto, 'content'>,
  ) {
    return this.chat.sendDirectMessage(user.id, login, dto.content);
  }
}
