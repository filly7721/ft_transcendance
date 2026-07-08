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
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'game must be a slug (lowercase letters, digits, hyphens)',
  })
  game!: string;

  /** Human-readable lobby name shown in the browser. */
  @IsString()
  @MaxLength(50)
  name!: string;

  /** Maximum number of players the lobby accepts (frontend offers 2 or 4). */
  @IsInt()
  @Min(2)
  @Max(4)
  maxPlayers!: number;

  /** Open-ended key/value options bag (e.g. { mode: "CASUAL" }). */
  @IsOptional()
  @IsObject()
  options?: Record<string, string>;
}
