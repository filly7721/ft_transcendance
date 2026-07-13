import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LobbiesService } from '../lobbies/lobbies.service';
import { ProfileService } from '../profile/profile.service';
import { CreateLobbyDto } from '../lobbies/dto/create-lobby.dto';
import { UpdateLobbyDto } from '../lobbies/dto/update-lobby.dto';
import { ApiKeyGuard } from '../api-keys/guards/api-key.guard';
import { ApiKeyThrottlerGuard } from '../api-keys/guards/api-key-throttler.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

/** Requests per minute allowed on the public API. Enforced twice over: per
 *  API key (ApiKeyThrottlerGuard) and, by the global guard reading the same
 *  metadata, per IP. */
const API_RATE_LIMIT = 100;

/**
 * The public API — `/api/v1/*`.
 *
 * This is the surface external callers (bots, scripts, dashboards) get, and it
 * is deliberately separate from the routes the frontend uses:
 *
 *  - It authenticates with an `X-API-Key` header, not a session JWT. Mint a
 *    key with `POST /api/keys` while logged in.
 *  - A key acts as its owner, so everything here is scoped to that account —
 *    you create lobbies as yourself and can only edit or delete your own.
 *  - It is versioned (`v1`), so the frontend's internal routes stay free to
 *    change without breaking anybody's integration.
 *  - It is rate-limited per key rather than per IP (see ApiKeyThrottlerGuard).
 *
 * Full request/response documentation: `GET /api/docs`.
 */
@ApiTags('public-api')
@ApiSecurity('api-key')
@Controller('v1')
@UseGuards(ApiKeyGuard, ApiKeyThrottlerGuard)
@Throttle({ default: { limit: API_RATE_LIMIT, ttl: 60_000 } })
@ApiResponse({ status: 401, description: 'Missing, unknown, or revoked key.' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded for this key.' })
export class PublicApiController {
  constructor(
    private readonly lobbies: LobbiesService,
    private readonly profile: ProfileService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Who this key belongs to',
    description: 'Echoes the account the calling API key acts on behalf of.',
  })
  me(@CurrentUser() user: AuthenticatedUser) {
    return { id: user.id, login: user.login };
  }

  @Get('lobbies')
  @ApiOperation({
    summary: 'List open lobbies',
    description:
      'Lobbies still waiting for players, newest first. Full lobbies and ' +
      'in-progress games are not listed.',
  })
  listLobbies(@Query('game') game?: string) {
    return this.lobbies.list(game ?? '');
  }

  @Post('lobbies')
  @ApiOperation({
    summary: 'Create a lobby',
    description:
      'Creates a lobby hosted by the key owner and returns its room code. ' +
      'As in the app, this also leaves any lobby the owner was already in.',
  })
  createLobby(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLobbyDto,
  ) {
    return this.lobbies.create(user.id, dto);
  }

  @Get('lobbies/:code')
  @ApiOperation({ summary: 'Fetch one lobby by room code' })
  @ApiResponse({ status: 404, description: 'No lobby with that room code.' })
  getLobby(@Param('code') code: string) {
    return this.lobbies.get(code);
  }

  @Put('lobbies/:code')
  @ApiOperation({
    summary: 'Update a lobby you host',
    description:
      'Send only the fields you want to change. Lobbies you do not host ' +
      'return 404 — the API will not confirm that someone else owns a code.',
  })
  @ApiResponse({ status: 404, description: 'No such lobby hosted by you.' })
  @ApiResponse({
    status: 409,
    description: 'maxPlayers lowered below the players already in the lobby.',
  })
  updateLobby(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Body() dto: UpdateLobbyDto,
  ) {
    return this.lobbies.update(user.id, code, dto);
  }

  @Delete('lobbies/:code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a lobby you host',
    description: 'Same ownership rule as update: not yours means 404.',
  })
  @ApiResponse({ status: 204, description: 'Lobby deleted.' })
  @ApiResponse({ status: 404, description: 'No such lobby hosted by you.' })
  async deleteLobby(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
  ): Promise<void> {
    await this.lobbies.removeAsHost(user.id, code);
  }

  @Get('players/:login')
  @ApiOperation({
    summary: "Fetch a player's public profile and game stats",
    description:
      'Public information only — the same data any user sees on a profile ' +
      'page. Email addresses are never exposed.',
  })
  @ApiResponse({ status: 404, description: 'No player with that login.' })
  getPlayer(@Param('login') login: string) {
    return this.profile.getPublicProfile(login);
  }
}
