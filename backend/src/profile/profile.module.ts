import { Module, forwardRef } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { SocialModule } from '../social/social.module';

/**
 * Profile feature module.
 *
 * Imports SocialModule via forwardRef because ProfileService needs
 * SocialGateway (to broadcast profile:update events to friends when a user
 * changes their login/displayName/avatar).
 */
@Module({
  imports: [forwardRef(() => SocialModule)],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
