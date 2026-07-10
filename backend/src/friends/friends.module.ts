import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

/**
 * Friends feature module.
 *
 * Depends on the global `PrismaModule` and `PresenceModule` (both @Global,
 * no explicit import needed). PresenceService provides real-time online
 * status for the friends list.
 */
@Module({
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
