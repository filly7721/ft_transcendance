import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
 * - `GET    /friends/blocked`         -> list users you have blocked (30/min/IP)
 * - `POST   /friends/block/:login`    -> block a user (10/min/IP)
 * - `DELETE /friends/block/:login`    -> lift your block (10/min/IP)
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

  // ParseIntPipe rejects garbage like /accept/abc with a 400. Plain
  // Number() would hand Prisma a NaN, which it answers with a
  // PrismaClientValidationError — a class PrismaExceptionFilter does not
  // catch, so the request died as an unhandled 500.
  @Post('accept/:id')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  acceptRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.friends.acceptRequest(user.id, id);
  }

  @Post('reject/:id')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  rejectRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.friends.rejectRequest(user.id, id);
  }

  @Post('block/:login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  block(@CurrentUser() user: AuthenticatedUser, @Param('login') login: string) {
    return this.friends.block(user.id, login);
  }

  // Declared BEFORE `@Delete(':login')`: Nest matches routes in declaration
  // order, so the wildcard below would otherwise swallow /friends/block/x and
  // try to unfriend a user called "block".
  @Delete('block/:login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  unblock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('login') login: string,
  ) {
    return this.friends.unblock(user.id, login);
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

  @Get('blocked')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  listBlocked(@CurrentUser() user: AuthenticatedUser) {
    return this.friends.listBlocked(user.id);
  }
}
