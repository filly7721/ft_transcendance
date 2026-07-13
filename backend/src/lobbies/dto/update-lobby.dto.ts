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
      'New player cap. Cannot be lowered below the number of players ' +
      'already in the lobby.',
    minimum: 2,
    maximum: 4,
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(4)
  maxPlayers?: number;

  @ApiPropertyOptional({
    description: 'Replaces the options bag wholesale (not merged).',
    example: { mode: 'RANKED' },
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, string>;
}
