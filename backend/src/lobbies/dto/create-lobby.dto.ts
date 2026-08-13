import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body for `POST /lobbies` (create a new lobby room).
 *
 * Matches the `CreateLobbyInput` shape the frontend already sends (see
 * `frontend/src/lib/lobbies.ts`):
 *   { game, name, maxPlayers, options }
 *
 * The `options` bag is intentionally open-ended: new lobby options are just
 * new keys the frontend adds, and the backend stores/echoes them verbatim.
 * The global `ValidationPipe` (`whitelist: true`) strips unknown top-level
 * properties, but `options` itself is kept because it is declared on the DTO.
 */
export class CreateLobbyDto {
  /** Game slug (e.g. "minesweeper", "super-tic-tac-toe"). */
  @ApiProperty({
    description: 'Game slug the lobby is for.',
    enum: ['minesweeper', 'super-tic-tac-toe'],
    example: 'super-tic-tac-toe',
  })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'game must be a slug (lowercase letters, digits, hyphens)',
  })
  game!: string;

  /** Human-readable lobby name shown in the browser. */
  @ApiProperty({
    description: 'Lobby name shown in the lobby browser.',
    example: 'friday night',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  name!: string;

  /**
   * Maximum number of players the lobby accepts.
   *
   * Must be 2. Every game here is 1v1 and both gateways seat exactly two
   * players, so a lobby created with 4 could never fill: the third connection
   * was turned away with `lobby_full` no matter what the lobby advertised.
   * Widen this the day a game seats more than two, and widen the gateways
   * with it.
   */
  @ApiProperty({
    description: 'Player cap for the lobby. Must be 2 — every game is 1v1.',
    minimum: 2,
    maximum: 2,
    example: 2,
  })
  @IsInt()
  @Min(2)
  @Max(2, { message: 'maxPlayers must be 2 — every game here is 1v1' })
  maxPlayers!: number;

  /** Open-ended key/value options bag (e.g. { mode: "CASUAL" }). */
  @ApiPropertyOptional({
    description: 'Open-ended options bag, echoed back verbatim.',
    example: { mode: 'CASUAL' },
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, string>;
}
