import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { SendMessageBodyDto } from './dto/send-message.dto';
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
@ApiBearerAuth('jwt')
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
    // ParseIntPipe rejects garbage like ?cursor=abc with a 400 instead of
    // letting NaN reach Prisma and blow up as a 500.
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
  ) {
    return this.chat.getHistory(user.id, login, cursor ?? null);
  }

  @Post(':login')
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // 30 msgs / min / IP
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('login') login: string,
    @Body() dto: SendMessageBodyDto,
  ) {
    return this.chat.sendDirectMessage(user.id, login, dto.content);
  }
}
