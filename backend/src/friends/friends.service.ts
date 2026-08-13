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

/** An entry in `GET /friends/blocked`. */
export interface BlockedUserResponse {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  blockedAt: Date;
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
      throw new ForbiddenException(
        'only the addressee can accept this request',
      );
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
      // requesterId is needed to tell the sender their request was turned down.
      select: { id: true, addresseeId: true, requesterId: true },
    });
    if (!friendship) {
      throw new NotFoundException(`friend request ${requestId} not found`);
    }
    if (friendship.addresseeId !== userId) {
      throw new ForbiddenException(
        'only the addressee can reject this request',
      );
    }

    await this.prisma.friendship.delete({ where: { id: requestId } });

    // Tell the sender, if they are connected. Rejection deletes the row, so
    // without this their outgoing list kept the request until a page reload.
    this.social.notifyFriendReject(friendship.requesterId, requestId);

    return { message: 'friend request rejected' };
  }

  /**
   * Block a user.
   *
   * A block is a `BLOCKED` friendship row owned by the blocker
   * (`requesterId` = whoever pressed the button). Blocking also *replaces*
   * whatever relationship existed: an accepted friendship, a request either
   * way, all of it goes, because blocking someone you are friends with has to
   * end the friendship or the block does nothing.
   *
   * Blocks are one-directional rows but bidirectional in effect. Two rows can
   * coexist — A blocking B and B blocking A are separate — which is why this
   * only ever touches the caller's own direction. Deleting the other party's
   * block here would let anyone clear a block on themselves by blocking back
   * and then unblocking.
   *
   * What a block does, in practice:
   *  - friend requests between the two are refused (`sendRequest` sees BLOCKED)
   *  - messaging and history stop, since both require an ACCEPTED row
   *  - typing indicators and read receipts stop, for the same reason
   *  - neither side sees the other's lobbies, and neither can join them
   *    (`LobbiesService`)
   */
  async block(
    userId: string,
    targetLogin: string,
  ): Promise<{ message: string }> {
    const target = await this.prisma.user.findUnique({
      where: { login: targetLogin },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException(`user '${targetLogin}' not found`);
    }
    if (target.id === userId) {
      throw new ConflictException('you cannot block yourself');
    }

    await this.prisma.$transaction(async (tx) => {
      // Drop the existing relationship in either direction, but never the
      // other party's block on us.
      await tx.friendship.deleteMany({
        where: {
          NOT: { status: STATUS_BLOCKED },
          OR: [
            { requesterId: userId, addresseeId: target.id },
            { requesterId: target.id, addresseeId: userId },
          ],
        },
      });
      // Idempotent: blocking twice is not an error.
      await tx.friendship.upsert({
        where: {
          requesterId_addresseeId: {
            requesterId: userId,
            addresseeId: target.id,
          },
        },
        create: {
          requesterId: userId,
          addresseeId: target.id,
          status: STATUS_BLOCKED,
        },
        update: { status: STATUS_BLOCKED },
      });
    });

    return { message: `blocked ${targetLogin}` };
  }

  /**
   * Lift a block you placed. Only removes the caller's own BLOCKED row, so a
   * mutual block survives until both sides lift it.
   *
   * Unblocking does not restore a friendship — the pair go back to strangers
   * and either can send a fresh request.
   */
  async unblock(
    userId: string,
    targetLogin: string,
  ): Promise<{ message: string }> {
    const target = await this.prisma.user.findUnique({
      where: { login: targetLogin },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException(`user '${targetLogin}' not found`);
    }

    const { count } = await this.prisma.friendship.deleteMany({
      where: {
        requesterId: userId,
        addresseeId: target.id,
        status: STATUS_BLOCKED,
      },
    });
    if (count === 0) {
      throw new NotFoundException(`you have not blocked ${targetLogin}`);
    }

    return { message: `unblocked ${targetLogin}` };
  }

  /** The users this caller has blocked (not the ones who blocked them). */
  async listBlocked(userId: string): Promise<BlockedUserResponse[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { requesterId: userId, status: STATUS_BLOCKED },
      select: {
        createdAt: true,
        addressee: {
          select: { id: true, login: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.addressee.id,
      login: r.addressee.login,
      displayName: r.addressee.displayName,
      avatarUrl: r.addressee.avatarUrl,
      blockedAt: r.createdAt,
    }));
  }

  /**
   * True if either of these two users has blocked the other.
   *
   * The single-pair counterpart to `getBlockedUserIds`, for the paths that
   * already know both parties (joining a specific lobby) and would otherwise
   * pull a whole exclusion list to check one id against it.
   */
  async isBlocked(a: string, b: string): Promise<boolean> {
    if (a === b) return false;
    const row = await this.prisma.friendship.findFirst({
      where: {
        status: STATUS_BLOCKED,
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
      select: { id: true },
    });
    return row !== null;
  }

  /**
   * Every user id on either side of a block with this user — the ones they
   * blocked AND the ones who blocked them.
   *
   * Both directions on purpose: hiding is symmetric. If you block someone you
   * should not see their lobbies, and they should not see yours either, or
   * blocking would just be a way to hide from someone while still watching
   * them. Callers use this as an exclusion list.
   */
  async getBlockedUserIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: STATUS_BLOCKED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map((r) =>
      r.requesterId === userId ? r.addresseeId : r.requesterId,
    );
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
    const statsRows =
      friendIds.length > 0
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
        stats: statsMap.get(friend.id) ?? {
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
        },
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
    return friendships.map((f) =>
      f.requesterId === userId ? f.addresseeId : f.requesterId,
    );
  }
}
