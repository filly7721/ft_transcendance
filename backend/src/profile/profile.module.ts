import { Module, forwardRef } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { SocialModule } from '../social/social.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Profile feature module.
 *
 * Imports SocialModule via forwardRef because ProfileService needs
 * SocialGateway (to broadcast profile:update events to friends when a user
 * changes their login/displayName/avatar).
 */
@Module({
  // AuthModule re-exports JwtModule: ProfileService reissues the JWT when
  // the login changes (the payload embeds the login).
  imports: [AuthModule, forwardRef(() => SocialModule)],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
