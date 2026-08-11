import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import { SocialGateway } from '../social/social.gateway';

/** Friend status constants. */
const STATUS_PENDING = 'PENDING';
const STATUS_ACCEPTED = 'ACCEPTED';
const STATUS_BLOCKED = 'BLOCKED';

/** Game stats shape. */
export interface GameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

/** A friend in the user's friends list, with real-time online status + stats. */
export interface FriendResponse {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  online: boolean;
  /** Friendship row ID (for potential management actions). */
  friendshipId: number;
  /** When the friendship was accepted. */
  friendsSince: Date;
  /** Game stats (wins/losses/draws aggregated from GameResult). */
  stats: GameStats;
}

/** A pending friend request (incoming or outgoing). */
export interface FriendRequestResponse {
  id: number;
  /** The other user's login. */
  login: string;
  displayName: string;
  avatarUrl: string | null;
  /** When the request was created. */
  createdAt: Date;
}

/** Response shape for `GET /friends/requests`. */
export interface FriendRequestsResponse {
  incoming: FriendRequestResponse[];
  outgoing: FriendRequestResponse[];
}

/**
 * Friends service — handles friend requests, acceptance, rejection, and
 * listing.
 *
 * A friendship is a single directional row: `requesterId` sent the request,
 * `addresseeId` received it. When accepted, both users are friends (the row
 * is shared). To find "my friends", we query rows where I am either the
 * requester OR the addressee AND status = ACCEPTED.
 *
 * Online status is derived from PresenceService (in-memory WebSocket
 * tracking) — no DB query needed.
 */
@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    @Inject(forwardRef(() => SocialGateway))
    private readonly social: SocialGateway,
  ) {}

  /**
   * Send a friend request to a user by their login.
   *
   * - 404 if the addressee doesn't exist.
   * - 409 if already friends, or a pending request already exists (either
   *   direction).
   * - Can't friend yourself (409).
   */
  async sendRequest(
    requesterId: string,
    addresseeLogin: string,
  ): Promise<{ id: number; status: string; message: string }> {
    const addressee = await this.prisma.user.findUnique({
      where: { login: addresseeLogin },
      select: { id: true, login: true },
    });
    if (!addressee) {
      throw new NotFoundException(`user '${addresseeLogin}' not found`);
    }
    if (addressee.id === requesterId) {
      throw new ConflictException('you cannot friend yourself');
    }

    // Check if a friendship already exists in either direction.
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId: addressee.id },
          { requesterId: addressee.id, addresseeId: requesterId },
        ],
      },
      select: { id: true, status: true },
    });
    if (existing) {
      if (existing.status === STATUS_ACCEPTED) {
        throw new ConflictException('you are already friends');
      }
      if (existing.status === STATUS_PENDING) {
        throw new ConflictException('a friend request is already pending');
      }
      if (existing.status === STATUS_BLOCKED) {
        throw new ConflictException('this friendship is blocked');
      }
    }

    const requester = await this.prisma.user.findUniqueOrThrow({
      where: { id: requesterId },
      select: { login: true, displayName: true, avatarUrl: true },
    });

    const friendship = await this.prisma.friendship.create({
      data: {
        requesterId,
        addresseeId: addressee.id,
        status: STATUS_PENDING,
      },
      select: { id: true, status: true, createdAt: true },
    });

    // Notify the addressee in real-time (if they're connected to /social)
    void this.social.notifyFriendRequest(addressee.id, {
      id: friendship.id,
      login: requester.login,
      displayName: requester.displayName,
      avatarUrl: requester.avatarUrl,
      createdAt: friendship.createdAt,
    });

    return {
      id: friendship.id,
      status: friendship.status,
      message: `friend request sent to ${addresseeLogin}`,
    };
  }

  /**
   * Accept a pending friend request.
   *
   * - 404 if the request doesn't exist.
   * - 403 if the user is not the addressee (only the receiver can accept).
   * - 409 if the request is not PENDING.
   */
  async acceptRequest(
    userId: string,
    requestId: number,
  ): Promise<{ message: string }> {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: requestId },
      select: { id: true, requesterId: true, addresseeId: true, status: true },
    });
    if (!friendship) {
      throw new NotFoundException(`friend request ${requestId} not found`);
    }
    if (friendship.addresseeId !== userId) {
      throw new ForbiddenException('only the addressee can accept this request');
    }
    if (friendship.status !== STATUS_PENDING) {
      throw new ConflictException(`request is already ${friendship.status}`);
    }

    const updated = await this.prisma.friendship.update({
      where: { id: requestId },
      data: { status: STATUS_ACCEPTED },
      select: { updatedAt: true },
    });

    // Notify the requester in real-time that their request was accepted
    const acceptor = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, login: true, displayName: true, avatarUrl: true },
    });

    const statsRows = await this.prisma.gameResult.groupBy({
      by: ['result'],
      where: { userId: acceptor.id },
      _count: { result: true },
    });
    const stats: GameStats = { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
    for (const r of statsRows) {
      const count = r._count.result;
      if (r.result === 'win') stats.wins = count;
      else if (r.result === 'loss') stats.losses = count;
      else if (r.result === 'draw') stats.draws = count;
      stats.gamesPlayed += count;
    }

    void this.social.notifyFriendAccept(friendship.requesterId, {
      id: acceptor.id,
      login: acceptor.login,
      displayName: acceptor.displayName,
      avatarUrl: acceptor.avatarUrl,
      online: this.presence.isOnline(userId),
      friendshipId: friendship.id,
      friendsSince: updated.updatedAt,
      stats,
    });

    return { message: 'friend request accepted' };
  }

  /**
   * Reject a pending friend request (deletes the row).
   *
   * - 404 if the request doesn't exist.
   * - 403 if the user is not the addressee.
   */
  async rejectRequest(
    userId: string,
    requestId: number,
  ): Promise<{ message: string }> {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: requestId },
      select: { id: true, addresseeId: true },
    });
    if (!friendship) {
      throw new NotFoundException(`friend request ${requestId} not found`);
    }
    if (friendship.addresseeId !== userId) {
      throw new ForbiddenException('only the addressee can reject this request');
    }

    await this.prisma.friendship.delete({ where: { id: requestId } });

    return { message: 'friend request rejected' };
  }

  /**
   * Unfriend a user by their login. Deletes the friendship row regardless
   * of who initiated it (also cancels an outgoing PENDING request).
   *
   * BLOCKED rows are excluded: a block must not be removable by the
   * blocked party simply calling unfriend.
   *
   * - 404 if no (non-blocked) friendship exists.
   */
  async unfriend(
    userId: string,
    friendLogin: string,
  ): Promise<{ message: string }> {
    const friend = await this.prisma.user.findUnique({
      where: { login: friendLogin },
      select: { id: true },
    });
    if (!friend) {
      throw new NotFoundException(`user '${friendLogin}' not found`);
    }

    const friendship = await this.prisma.friendship.findFirst({
      where: {
        NOT: { status: STATUS_BLOCKED },
        OR: [
          { requesterId: userId, addresseeId: friend.id },
          { requesterId: friend.id, addresseeId: userId },
        ],
      },
      select: { id: true },
    });
    if (!friendship) {
      throw new NotFoundException(`you are not friends with ${friendLogin}`);
    }

    await this.prisma.friendship.delete({ where: { id: friendship.id } });

    return { message: `unfriended ${friendLogin}` };
  }

  /**
   * List the user's accepted friends, with real-time online status.
   *
   * Queries both directions (I'm the requester OR I'm the addressee) where
   * status = ACCEPTED. Returns the OTHER user's info.
   */
  async listFriends(userId: string): Promise<FriendResponse[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: STATUS_ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: {
        id: true,
        updatedAt: true,
        requester: {
          select: { id: true, login: true, displayName: true, avatarUrl: true },
        },
        addressee: {
          select: { id: true, login: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Extract friend IDs for the batch stats query.
    const friendIds = friendships.map((f) => {
      const friend = f.requester.id === userId ? f.addressee : f.requester;
      return friend.id;
    });

    // Batch-fetch game stats for all friends in one groupBy query.
    // Grouping by userId + result gives us counts per user per result type.
    const statsRows = friendIds.length > 0
      ? await this.prisma.gameResult.groupBy({
          by: ['userId', 'result'],
          where: { userId: { in: friendIds } },
          _count: { result: true },
        })
      : [];

    // Build a Map<userId, GameStats> from the grouped rows.
    const statsMap = new Map<string, GameStats>();
    for (const row of statsRows) {
      let stats = statsMap.get(row.userId);
      if (!stats) {
        stats = { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
        statsMap.set(row.userId, stats);
      }
      const count = row._count.result;
      if (row.result === 'win') stats.wins = count;
      else if (row.result === 'loss') stats.losses = count;
      else if (row.result === 'draw') stats.draws = count;
      stats.gamesPlayed += count;
    }

    return friendships.map((f) => {
      const friend = f.requester.id === userId ? f.addressee : f.requester;
      return {
        id: friend.id,
        login: friend.login,
        displayName: friend.displayName,
        avatarUrl: friend.avatarUrl,
        online: this.presence.isOnline(friend.id),
        friendshipId: f.id,
        friendsSince: f.updatedAt,
        stats: statsMap.get(friend.id) ?? { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 },
      };
    });
  }

  /**
   * List pending friend requests (incoming + outgoing).
   *
   * - Incoming: requests where I am the addressee (others want to friend me).
   * - Outgoing: requests where I am the requester (I want to friend others).
   */
  async listRequests(userId: string): Promise<FriendRequestsResponse> {
    const [incoming, outgoing] = await Promise.all([
      this.prisma.friendship.findMany({
        where: { addresseeId: userId, status: STATUS_PENDING },
        select: {
          id: true,
          createdAt: true,
          requester: {
            select: { login: true, displayName: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.friendship.findMany({
        where: { requesterId: userId, status: STATUS_PENDING },
        select: {
          id: true,
          createdAt: true,
          addressee: {
            select: { login: true, displayName: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      incoming: incoming.map((r) => ({
        id: r.id,
        login: r.requester.login,
        displayName: r.requester.displayName,
        avatarUrl: r.requester.avatarUrl,
        createdAt: r.createdAt,
      })),
      outgoing: outgoing.map((r) => ({
        id: r.id,
        login: r.addressee.login,
        displayName: r.addressee.displayName,
        avatarUrl: r.addressee.avatarUrl,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * Get an array of user IDs for all accepted friends of the given user.
   */
  async getFriendIds(userId: string): Promise<string[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: STATUS_ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    return friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));
  }
}
