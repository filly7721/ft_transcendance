import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import type { LobbyResponse } from './dto/lobby-response';
import { generateRoomCode } from './room-code';

/** Prisma payload type for a lobby with its relations eagerly included. */
type LobbyWithRelations = Prisma.LobbyGetPayload<{
  include: { members: true; host: true };
}>;

/** Lobby statuses. Kept as plain strings (not a Prisma enum) so the schema
 *  stays wire-compatible with both SQLite and Postgres without extra setup. */
const LOBBY_STATUS_WAITING = 'WAITING';

/** Max room-code collision retries before giving up. 10 is absurdly safe: the
 *  code space is 10^9 and existing rows are tiny, so the chance of even one
 *  collision is negligible. */
const MAX_CODE_RETRIES = 10;

/**
 * Data-access + business-logic layer for lobby rooms.
 *
 * A lobby is identified by its room code (`id`, format "xxx-xxx-xxx") which
 * also acts as the secret needed to join. The creator becomes the host and
 * the first member. Other authenticated users join by code; the member count
 * is computed from the `LobbyMember` join table at read time.
 *
 * `options` is stored as a JSON string (SQLite has no native JSON column) and
 * parsed back to a `Record<string, string>` on every response so the frontend
 * gets the exact open-ended shape it already consumes.
 */
@Injectable()
export class LobbiesService {
  constructor(private readonly prisma: PrismaService) {}

  /** List open (WAITING, not full) lobbies for a game, newest first. */
  async list(game: string): Promise<LobbyResponse[]> {
    const lobbies = await this.prisma.lobby.findMany({
      where: { game, status: LOBBY_STATUS_WAITING },
      include: { members: true, host: true },
      orderBy: { createdAt: 'desc' },
    });

    return lobbies
      .filter((l) => l.members.length < l.maxPlayers)
      .map((l) => this.serialize(l));
  }

  /**
   * Create a new lobby room.
   *
   *  1. Generate a unique room code (retries on collision).
   *  2. In a transaction: create the Lobby row + add the creator as the first
   *     LobbyMember (so `players` starts at 1).
   *  3. Re-fetch with relations and return the serialized lobby.
   */
  async create(hostId: number, dto: CreateLobbyDto): Promise<LobbyResponse> {
    const id = await this.generateUniqueRoomCode();
    const optionsJson = JSON.stringify(dto.options ?? {});

    await this.prisma.$transaction(async (tx) => {
      await tx.lobby.create({
        data: {
          id,
          game: dto.game,
          name: dto.name,
          hostId,
          maxPlayers: dto.maxPlayers,
          options: optionsJson,
          status: LOBBY_STATUS_WAITING,
        },
      });
      await tx.lobbyMember.create({
        data: { lobbyId: id, userId: hostId },
      });
    });

    const lobby = await this.prisma.lobby.findUniqueOrThrow({
      where: { id },
      include: { members: true, host: true },
    });
    return this.serialize(lobby);
  }

  /**
   * Join a lobby by its room code.
   *
   * - 404 if no lobby has that code.
   * - 409 if the lobby is already full.
   * - Idempotent: if the user is already a member, returns the lobby without
   *   error (so a double-click or retry is safe).
   */
  async join(userId: number, roomCode: string): Promise<LobbyResponse> {
    const lobby = await this.prisma.lobby.findUnique({
      where: { id: roomCode },
      include: { members: true, host: true },
    });
    if (!lobby) {
      throw new NotFoundException('lobby not found');
    }

    const alreadyMember = lobby.members.some((m) => m.userId === userId);
    if (!alreadyMember) {
      if (lobby.members.length >= lobby.maxPlayers) {
        throw new ConflictException('lobby is full');
      }
      await this.prisma.lobbyMember.create({
        data: { lobbyId: roomCode, userId },
      });
    }

    // Re-fetch to reflect the new member count.
    const updated = await this.prisma.lobby.findUniqueOrThrow({
      where: { id: roomCode },
      include: { members: true, host: true },
    });
    return this.serialize(updated);
  }

  // ----- internals --------------------------------------------------------

  /** Generate room codes until one is free (or MAX_CODE_RETRIES is hit). */
  private async generateUniqueRoomCode(): Promise<string> {
    for (let i = 0; i < MAX_CODE_RETRIES; i++) {
      const code = generateRoomCode();
      const existing = await this.prisma.lobby.findUnique({
        where: { id: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    throw new Error(
      'failed to generate a unique room code after ' +
        `${MAX_CODE_RETRIES} attempts`,
    );
  }

  /** Map a Prisma lobby row (with relations) to the public `LobbyResponse`. */
  private serialize(lobby: LobbyWithRelations): LobbyResponse {
    return {
      id: lobby.id,
      game: lobby.game,
      name: lobby.name,
      host: lobby.host.login,
      players: lobby.members.length,
      maxPlayers: lobby.maxPlayers,
      options: this.parseOptions(lobby.options),
    };
  }

  /** Safe JSON.parse of the options column — never throws. */
  private parseOptions(raw: string | null): Record<string, string> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, string>)
        : {};
    } catch {
      return {};
    }
  }
}
