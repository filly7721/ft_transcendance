import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body for `PUT /api/v1/lobbies/:code` (public API, host only).
 *
 * Every field is optional: send only what you want to change. `game` is
 * deliberately NOT updatable — a lobby's game decides which gateway serves its
 * room code, so switching it out from under a live room would strand the
 * players already in it.
 */
export class UpdateLobbyDto {
  @ApiPropertyOptional({
    description: 'New lobby name.',
    example: 'friday night rematch',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    description:
      'New player cap. Must be 2 — every game here is 1v1, and both ' +
      'gateways seat exactly two players.',
    minimum: 2,
    maximum: 2,
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(2, { message: 'maxPlayers must be 2 — every game here is 1v1' })
  maxPlayers?: number;

  @ApiPropertyOptional({
    description: 'Replaces the options bag wholesale (not merged).',
    example: { mode: 'CASUAL' },
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, string>;
}
