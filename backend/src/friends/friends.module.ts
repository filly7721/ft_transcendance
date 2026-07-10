import { Module, forwardRef } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { SocialModule } from '../social/social.module';

/**
 * Friends feature module.
 *
 * Depends on the global `PrismaModule` and `PresenceModule` (both @Global).
 *
 * Circular dependency: FriendsService needs SocialGateway (to emit real-time
 * notifications when requests are sent/accepted), and SocialModule imports
 * FriendsModule (SocialGateway needs FriendsService for getFriendIds +
 * listFriends + listRequests). We break the cycle with forwardRef on both
 * sides:
 *   - FriendsModule imports SocialModule via forwardRef
 *   - FriendsService injects SocialGateway via @Inject(forwardRef(() => SocialGateway))
 *   - SocialModule imports FriendsModule (normal import — it's the other half)
 */
@Module({
  imports: [forwardRef(() => SocialModule)],
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
