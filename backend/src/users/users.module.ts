import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

/**
 * Users module.
 *
 * Exports UsersService so the AuthModule can inject it. The controller only
 * exposes a guarded `/users/me` used to validate the JWT and fetch the
 * current user's profile. Full profile editing belongs to the User
 * Management module.
 */
@Module({
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
