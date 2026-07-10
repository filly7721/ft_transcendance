import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** A conversation in the user's inbox (one per friend they've chatted with). */
export interface ConversationResponse {
  /** The peer's login. */
  peerLogin: string;
  /** The peer's display name. */
  peerDisplayName: string;
  /** The peer's avatar URL (null = default). */
  peerAvatarUrl: string | null;
  /** The last message in the conversation (newest). */
  lastMessage: {
    content: string;
    senderLogin: string;
    createdAt: Date;
  };
  /** Number of unread messages from this peer. */
  unreadCount: number;
}

/** A single message in a conversation thread. */
export interface MessageResponse {
  id: number;
  senderLogin: string;
  receiverLogin: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
}

/** Paginated history response (cursor-based, newest first). */
export interface HistoryResponse {
  messages: MessageResponse[];
  /** Cursor for the next page (oldest message ID in this batch). Null if no more. */
  nextCursor: number | null;
}

/**
 * Chat service — handles message persistence, conversation listing, history
 * retrieval, and read receipts.
 *
 * All methods assume the caller is authenticated. Authorization (friend check)
 * is enforced in sendDirectMessage and getHistory.
 */
@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Send a direct message from one user to another.
   *
   * - 403 if the users are not accepted friends.
   * - Content validation (1-1000 chars) is done by the DTO/class-validator.
   */
  async sendDirectMessage(
    senderId: string,
    receiverLogin: string,
    content: string,
  ): Promise<MessageResponse> {
    const receiver = await this.prisma.user.findUnique({
      where: { login: receiverLogin },
      select: { id: true, login: true },
    });
    if (!receiver) {
      throw new ForbiddenException(`user '${receiverLogin}' not found`);
    }

    // Authorization: can only message accepted friends.
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: senderId, addresseeId: receiver.id },
          { requesterId: receiver.id, addresseeId: senderId },
        ],
      },
      select: { id: true },
    });
    if (!friendship) {
      throw new ForbiddenException('you can only message your friends');
    }

    const sender = await this.prisma.user.findUniqueOrThrow({
      where: { id: senderId },
      select: { login: true },
    });

    const message = await this.prisma.message.create({
      data: { senderId, receiverId: receiver.id, content },
      select: {
        id: true,
        content: true,
        readAt: true,
        createdAt: true,
      },
    });

    return {
      id: message.id,
      senderLogin: sender.login,
      receiverLogin: receiver.login,
      content: message.content,
      readAt: message.readAt,
      createdAt: message.createdAt,
    };
  }

  /**
   * List conversations for the authenticated user.
   *
   * Returns one entry per friend they've exchanged messages with, including
   * the last message and unread count.
   */
  async getConversations(userId: string): Promise<ConversationResponse[]> {
    // Find all users the current user has messaged or been messaged by.
    const partners = await this.prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
      distinct: ['senderId', 'receiverId'],
    });

    // Extract unique partner IDs.
    const partnerIds = new Set<string>();
    for (const p of partners) {
      if (p.senderId !== userId) partnerIds.add(p.senderId);
      if (p.receiverId !== userId) partnerIds.add(p.receiverId);
    }

    const conversations: ConversationResponse[] = [];
    for (const partnerId of partnerIds) {
      const partner = await this.prisma.user.findUnique({
        where: { id: partnerId },
        select: { login: true, displayName: true, avatarUrl: true },
      });
      if (!partner) continue;

      const [lastMsg, unreadCount] = await Promise.all([
        this.prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: partnerId },
              { senderId: partnerId, receiverId: userId },
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: { content: true, senderId: true, createdAt: true },
        }),
        this.prisma.message.count({
          where: { senderId: partnerId, receiverId: userId, readAt: null },
        }),
      ]);

      if (!lastMsg) continue;

      const sender = lastMsg.senderId === userId ? (await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { login: true } })).login : partner.login;

      conversations.push({
        peerLogin: partner.login,
        peerDisplayName: partner.displayName,
        peerAvatarUrl: partner.avatarUrl,
        lastMessage: {
          content: lastMsg.content,
          senderLogin: sender,
          createdAt: lastMsg.createdAt,
        },
        unreadCount,
      });
    }

    // Sort by last message time, newest first.
    conversations.sort(
      (a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime(),
    );
    return conversations;
  }

  /**
   * Get paginated message history with a friend.
   *
   * Returns messages newest-first. `cursor` is the oldest message ID from
   * the previous batch (pass null for the first page).
   *
   * - 403 if the users are not accepted friends.
   */
  async getHistory(
    userId: string,
    peerLogin: string,
    cursor: number | null,
    limit = 50,
  ): Promise<HistoryResponse> {
    const peer = await this.prisma.user.findUnique({
      where: { login: peerLogin },
      select: { id: true, login: true },
    });
    if (!peer) {
      throw new ForbiddenException(`user '${peerLogin}' not found`);
    }

    // Friend check.
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId, addresseeId: peer.id },
          { requesterId: peer.id, addresseeId: userId },
        ],
      },
      select: { id: true },
    });
    if (!friendship) {
      throw new ForbiddenException('you can only view history with your friends');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: peer.id },
          { senderId: peer.id, receiverId: userId },
        ],
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        readAt: true,
        createdAt: true,
        sender: { select: { login: true } },
        receiver: { select: { login: true } },
      },
    });

    const result: MessageResponse[] = messages.map((m) => ({
      id: m.id,
      senderLogin: m.sender.login,
      receiverLogin: m.receiver.login,
      content: m.content,
      readAt: m.readAt,
      createdAt: m.createdAt,
    }));

    return {
      messages: result,
      nextCursor: result.length === limit ? result[result.length - 1].id : null,
    };
  }

  /**
   * Mark all unread messages from a peer as read.
   * Returns the count of messages marked as read.
   */
  async markAsRead(
    userId: string,
    peerLogin: string,
  ): Promise<{ marked: number }> {
    const peer = await this.prisma.user.findUnique({
      where: { login: peerLogin },
      select: { id: true },
    });
    if (!peer) return { marked: 0 };

    const result = await this.prisma.message.updateMany({
      where: { senderId: peer.id, receiverId: userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { marked: result.count };
  }

  /**
   * Get the user IDs of a user's accepted friends (for presence broadcasts).
   * Used by the chat gateway to know who to notify when a user comes online
   * or goes offline.
   */
  async getFriendIds(userId: string): Promise<string[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: {
        requesterId: true,
        addresseeId: true,
      },
    });
    return friendships.map((f) =>
      f.requesterId === userId ? f.addresseeId : f.requesterId,
    );
  }
}
