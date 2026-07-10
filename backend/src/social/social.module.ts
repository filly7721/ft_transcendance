import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import { SocialGateway } from './social.gateway';

/**
 * Social feature module.
 *
 * Provides the SocialGateway (namespace /social) for real-time social
 * notifications: presence updates, friend request notifications, friend
 * accept notifications.
 *
 * Imports AuthModule for JwtService + WsRateLimiter. Depends on the global
 * PresenceModule and FriendsModule (FriendsService for getFriendIds +
 * listFriends + listRequests).
 *
 * Circular dependency: SocialModule imports FriendsModule (for FriendsService),
 * and FriendsModule imports SocialModule (for SocialGateway). Both sides use
 * forwardRef to break the cycle.
 */
@Module({
  imports: [AuthModule, forwardRef(() => FriendsModule)],
  providers: [SocialGateway],
  exports: [SocialGateway],
})
export class SocialModule {}
