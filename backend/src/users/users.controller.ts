import {
  Controller,
  Get,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

/**
 * Minimal user endpoints. Only `/users/me` for now: it proves the JWT guard
 * works and gives the frontend the current user's profile after login.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.users.findById(user.id);
    // The JWT is stateless, so a token issued before the account was deleted
    // is still signature-valid. If the user no longer exists, reject the
    // request here so deleted accounts cannot keep using the API.
    if (!profile) {
      throw new UnauthorizedException('account no longer exists');
    }
    // `findById` uses `publicUserSelect`, so `passwordHash` is already absent.
    return profile;
  }
}
