import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Shape of `req.user` after the JwtStrategy has validated the token.
 * Kept here (and not in auth/) so the users controller does not need to know
 * about the auth module internals.
 */
export interface AuthenticatedUser {
  id: number;
  login: string;
}

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * Minimal user endpoints. Only `/users/me` for now: it proves the JWT guard
 * works and gives the frontend the current user's profile after login.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: AuthenticatedRequest) {
    const user = await this.users.findById(req.user.id);
    if (!user) {
      return null;
    }
    // Never leak the password hash.
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
