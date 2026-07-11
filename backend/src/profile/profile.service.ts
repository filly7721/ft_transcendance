import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { publicUserSelect } from '../users/users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SocialGateway } from '../social/social.gateway';

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
 * Profile service — handles profile updates (displayName, login, avatar),
 * avatar uploads, and public profile lookups.
 *
 * Injects SocialGateway via forwardRef to broadcast profile:update events
 * to the user's friends when their login/displayName/avatar changes.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SocialGateway))
    private readonly social: SocialGateway,
  ) {}

  /**
   * Update the authenticated user's profile (displayName, login, avatarUrl).
   * Returns the updated user (public shape, no passwordHash).
   *
   * If login is changing, checks uniqueness first (409 Conflict if taken).
   * Broadcasts a profile:update to the user's friends after success.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UpdatedProfile> {
    const data: { displayName?: string; login?: string; avatarUrl?: string } = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

    // If login is changing, check uniqueness first.
    if (dto.login !== undefined) {
      const existing = await this.prisma.user.findUnique({
        where: { login: dto.login },
        select: { id: true },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException(`login '${dto.login}' is already taken`);
      }
      data.login = dto.login;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: publicUserSelect,
    }) as UpdatedProfile;

    // Broadcast a profile:update to the user's friends so their friends list
    // re-fetches and shows the new login/displayName.
    void this.social.notifyProfileUpdate(userId);

    return updated;
  }

  /**
   * Save the avatar URL after multer has written the file to disk.
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
   * Does NOT include email. Includes basic game stats.
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
