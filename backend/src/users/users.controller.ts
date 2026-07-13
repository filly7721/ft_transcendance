import {
  Controller,
  Get,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

/** Game stats shape returned with the user profile. */
export interface GameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

/** Shape returned by GET /users/me — SafeUser + stats. */
export interface MeResponse {
  id: string;
  email: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  stats: GameStats;
}

/**
 * User endpoints.
 *
 * `GET /users/me` returns the authenticated user's profile + game stats
 * (aggregated from the GameResult table via Prisma groupBy).
 */
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    const profile = await this.users.findById(user.id);
    if (!profile) {
      throw new UnauthorizedException('account no longer exists');
    }

    // Aggregate game results for stats.
    const results = await this.prisma.gameResult.groupBy({
      by: ['result'],
      where: { userId: user.id },
      _count: { result: true },
    });

    const stats: GameStats = {
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

    return { ...profile, stats };
  }
}
