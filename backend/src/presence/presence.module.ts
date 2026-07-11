import { Global, Module } from '@nestjs/common';
import { PresenceService } from './presence.service';

/**
 * Global presence module.
 *
 * @Global() so PresenceService is available everywhere without each module
 * importing PresenceModule explicitly. Used by:
 *   - FriendsModule: to show online status in the friends list
 *   - ChatModule (Phase 3): to deliver messages only to online users, and
 *     to broadcast presence updates to friends
 */
@Global()
@Module({
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
