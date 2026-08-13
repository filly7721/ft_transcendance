import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

/**
 * API-key management — how a logged-in user gets credentials for the public
 * API. These routes are JWT-guarded (you sign in as yourself to mint a key);
 * the keys they hand out are what authenticates `/api/v1/*` afterwards.
 */
@ApiTags('api-keys')
@ApiBearerAuth('jwt')
@Controller('keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 new keys / min / IP
  @ApiOperation({
    summary: 'Mint a new API key',
    description:
      'Returns the raw key ONCE — it is stored only as a hash and cannot be ' +
      'retrieved again. Copy it now; if you lose it, revoke it and mint another.',
  })
  @ApiResponse({
    status: 201,
    description: 'Key created; `key` is the secret.',
  })
  @ApiResponse({
    status: 409,
    description:
      'You already hold an active key. A user may have only one at a time — ' +
      'revoke it first.',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateApiKeyDto) {
    return this.apiKeys.create(user.id, dto.name);
  }

  @Get('active')
  @ApiOperation({
    summary: 'Your current API key',
    description:
      'The one active key, or null if you hold none. Never includes the ' +
      'secret — that is returned only when the key is minted.',
  })
  active(@CurrentUser() user: AuthenticatedUser) {
    return this.apiKeys.active(user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List your API keys',
    description: 'Secrets are never returned — only the display prefix.',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.apiKeys.list(user.id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Revoke an API key',
    description:
      'The key stops working immediately. The record is kept (with a ' +
      'revocation timestamp) so your key list stays auditable.',
  })
  @ApiResponse({ status: 404, description: 'No such key owned by you.' })
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.apiKeys.revoke(user.id, id);
  }
}
