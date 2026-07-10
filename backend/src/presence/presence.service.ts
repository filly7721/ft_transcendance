import { Injectable, Logger } from '@nestjs/common';

/**
 * In-memory presence tracking service.
 *
 * Tracks which users are currently connected via WebSocket. A user can have
 * multiple concurrent connections (multiple tabs/devices), so we store a
 * `Set<socketId>` per user. A user is "online" if their set is non-empty.
 *
 * This is a @Global service (see PresenceModule) so both FriendsModule and
 * ChatModule can query online status without importing PresenceModule.
 *
 * Limitation: in-memory only. If the backend runs as multiple instances
 * (microservices/future), this would need a Redis adapter. Out of scope for
 * now — single-server is fine for ft_transcendence.
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  /** userId → Set of active socket IDs. */
  private readonly connections = new Map<string, Set<string>>();

  /** Register a socket connection for a user. */
  connect(userId: string, socketId: string): void {
    let sockets = this.connections.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.connections.set(userId, sockets);
    }
    sockets.add(socketId);
    this.logger.debug(`user ${userId} connected (socket ${socketId}, ${sockets.size} total)`);
  }

  /** Remove a socket connection for a user. */
  disconnect(userId: string, socketId: string): void {
    const sockets = this.connections.get(userId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.connections.delete(userId);
      this.logger.debug(`user ${userId} is now offline (last socket disconnected)`);
    } else {
      this.logger.debug(`user ${userId} socket ${socketId} disconnected (${sockets.size} remaining)`);
    }
  }

  /** True if the user has at least one active connection. */
  isOnline(userId: string): boolean {
    const sockets = this.connections.get(userId);
    return sockets !== undefined && sockets.size > 0;
  }

  /** Get the set of currently-online user IDs. */
  getOnlineUserIds(): Set<string> {
    return new Set(this.connections.keys());
  }
}
