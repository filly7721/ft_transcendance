import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

/**
 * Friends feature module.
 *
 * Depends on the global `PrismaModule` and `PresenceModule` (both @Global).
 * SocialGateway is injected via forwardRef to avoid a circular dependency
 * (SocialModule imports FriendsModule for FriendsService, FriendsService
 * needs SocialGateway for real-time notifications).
 */
@Module({
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
