import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

/**
 * Friends endpoints.
 *
 * All routes are JWT-guarded.
 *
 * - `POST   /friends/request/:login`  -> send a friend request (10/min/IP)
 * - `POST   /friends/accept/:id`      -> accept a pending request (10/min/IP)
 * - `POST   /friends/reject/:id`      -> reject a pending request (10/min/IP)
 * - `DELETE /friends/:login`          -> unfriend (10/min/IP)
 * - `GET    /friends`                 -> list accepted friends + online status (30/min/IP)
 * - `GET    /friends/requests`        -> list pending requests (incoming + outgoing) (30/min/IP)
 */
@Controller('friends')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Post('request/:login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  sendRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('login') login: string,
  ) {
    return this.friends.sendRequest(user.id, login);
  }

  @Post('accept/:id')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  acceptRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.friends.acceptRequest(user.id, Number(id));
  }

  @Post('reject/:id')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  rejectRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.friends.rejectRequest(user.id, Number(id));
  }

  @Delete(':login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  unfriend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('login') login: string,
  ) {
    return this.friends.unfriend(user.id, login);
  }

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  listFriends(@CurrentUser() user: AuthenticatedUser) {
    return this.friends.listFriends(user.id);
  }

  @Get('requests')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  listRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.friends.listRequests(user.id);
  }
}
