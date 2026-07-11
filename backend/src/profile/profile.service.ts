import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { basename, join } from 'path';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { publicUserSelect } from '../users/users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SocialGateway } from '../social/social.gateway';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

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
  /**
   * A fresh JWT, present ONLY when the login changed. The old token still
   * carries the old login, which other parts of the system (ws gateways,
   * display) read from the payload — the client must swap to this one.
   */
  accessToken?: string;
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
    private readonly jwt: JwtService,
    @Inject(forwardRef(() => SocialGateway))
    private readonly social: SocialGateway,
  ) {}

  /**
   * Update the authenticated user's profile (displayName, login, avatarUrl).
   * Returns the updated user (public shape, no passwordHash).
   *
   * If login is changing, checks uniqueness first (409 Conflict if taken)
   * and reissues the JWT: the token payload carries the login, so keeping
   * the old token would leave every new ws connection tagged with a login
   * that no longer exists. Broadcasts a profile:update to the user's
   * friends after success.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UpdatedProfile> {
    const data: { displayName?: string; login?: string; avatarUrl?: string } = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

    // If login is actually changing, check uniqueness first.
    let loginChanged = false;
    if (dto.login !== undefined) {
      const current = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { login: true },
      });
      if (dto.login !== current.login) {
        const existing = await this.prisma.user.findUnique({
          where: { login: dto.login },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException(`login '${dto.login}' is already taken`);
        }
        data.login = dto.login;
        loginChanged = true;
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: publicUserSelect,
    }) as UpdatedProfile;

    if (loginChanged) {
      const payload: JwtPayload = { sub: userId, login: updated.login };
      updated.accessToken = await this.jwt.signAsync(payload);
    }

    // Broadcast a profile:update to the user's friends so their friends list
    // re-fetches and shows the new login/displayName.
    void this.social.notifyProfileUpdate(userId);

    return updated;
  }

  /**
   * Save the avatar URL after multer has written the file to disk, and
   * delete the previous avatar file (if it was one of ours) so uploads
   * don't accumulate on disk forever.
   */
  async saveAvatarUrl(
    userId: string,
    filename: string,
  ): Promise<{ avatarUrl: string }> {
    const relativePath = `/api/uploads/avatars/${filename}`;
    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: relativePath },
      select: { id: true },
    });

    // Best-effort cleanup of the replaced file. basename() confines the
    // delete to the avatars directory even if the stored URL was tampered
    // with, and external URLs (different prefix) are left alone.
    const old = previous?.avatarUrl;
    if (old && old.startsWith('/api/uploads/avatars/') && old !== relativePath) {
      const oldPath = join(process.cwd(), 'uploads', 'avatars', basename(old));
      await unlink(oldPath).catch(() => undefined);
    }

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
