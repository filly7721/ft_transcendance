import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LobbiesService } from './lobbies.service';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

/**
 * Lobby room endpoints.
 *
 * - `GET  /lobbies?game=<slug>`  -> list open lobbies for a game (JWT).
 * - `POST /lobbies`              -> create a lobby (JWT, body = CreateLobbyDto).
 *                                   Returns the new lobby with its room code.
 * - `POST /lobbies/:id/join`     -> join a lobby by room code (JWT).
 *                                   `:id` is the "xxx-xxx-xxx" room code.
 *
 * The room code returned by `create` is the secret the host shares with
 * friends so they can join via "JOIN BY CODE" on the frontend.
 */
@Controller('lobbies')
export class LobbiesController {
  constructor(private readonly lobbies: LobbiesService) {}

  /**
   * Now JWT-guarded, where it used to be open. The list has to know who is
   * asking to leave out lobbies hosted by someone they have blocked (or who
   * blocked them), and there is no sensible answer to "what does an anonymous
   * caller see" for a blocklist. It closes a leak besides: room codes ARE the
   * join secret, and this route handed them to anyone who asked.
   *
   * No practical loss of access — the browser only renders this list behind
   * the authenticated `(with-sidebar)` layout.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // 30 lists / min / IP
  list(@CurrentUser() user: AuthenticatedUser, @Query('game') game: string) {
    if (!game) {
      return [];
    }
    return this.lobbies.list(game, user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 creates / min / IP
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLobbyDto) {
    return this.lobbies.create(user.id, dto);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @Throttle({ default: { limit: 20, ttl: 60_000 } }) // 20 joins / min / IP
  join(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.lobbies.join(user.id, id);
  }
}
