import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { publicUserSelect } from '../users/users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Shape of the public profile returned by `GET /users/:login`.
 *
 * Includes basic stats (games played, wins, losses, draws) aggregated from
 * the GameResult table. `email` is NEVER included — public profiles must not
 * leak contact info.
 */
export interface PublicProfile {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
  };
}

/** Shape returned by `PATCH /users/me` — the updated SafeUser. */
export type UpdatedProfile = {
  id: string;
  email: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Profile service — handles profile updates, avatar uploads, and public
 * profile lookups.
 *
 * Avatar files are saved to `uploads/avatars/` by multer's diskStorage
 * (configured in the controller). The service just stores the relative URL
 * (`/uploads/avatars/<filename>`) in the DB. The file is served by
 * express.static in main.ts.
 */
@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Update the authenticated user's profile (displayName and/or avatarUrl).
   * Returns the updated user (public shape, no passwordHash).
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UpdatedProfile> {
    const data: { displayName?: string; avatarUrl?: string } = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: publicUserSelect,
    }) as Promise<UpdatedProfile>;
  }

  /**
   * Save the avatar URL after multer has written the file to disk.
   *
   * The file is already on disk (multer diskStorage handled it). This method
   * just constructs the relative URL and updates the user's `avatarUrl`.
   *
   * @param userId The authenticated user's ID.
   * @param filename The filename multer generated (e.g. "uuid-123456.png").
   * @returns `{ avatarUrl: string }` — the relative path to the avatar.
   */
  async saveAvatarUrl(
    userId: string,
    filename: string,
  ): Promise<{ avatarUrl: string }> {
    const relativePath = `/api/uploads/avatars/${filename}`;
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: relativePath },
      select: { id: true },
    });
    return { avatarUrl: relativePath };
  }

  /**
   * Get a user's public profile by login.
   *
   * Returns: id, login, displayName, avatarUrl, createdAt, and basic stats
   * (gamesPlayed, wins, losses, draws). Does NOT include email.
   *
   * @throws NotFoundException if no user has that login.
   */
  async getPublicProfile(login: string): Promise<PublicProfile> {
    const user = await this.prisma.user.findUnique({
      where: { login },
      select: {
        id: true,
        login: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`user '${login}' not found`);
    }

    // Aggregate game results for stats.
    const results = await this.prisma.gameResult.groupBy({
      by: ['result'],
      where: { userId: user.id },
      _count: { result: true },
    });

    const stats = {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    };
    for (const r of results) {
      const count = r._count.result;
      if (r.result === 'win') stats.wins = count;
      else if (r.result === 'loss') stats.losses = count;
      else if (r.result === 'draw') stats.draws = count;
      stats.gamesPlayed += count;
    }

    return { ...user, stats };
  }
}
