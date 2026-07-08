import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Parameter decorator that injects the authenticated user directly into a
 * controller method's signature.
 *
 * Replaces the verbose `@Req() req: AuthenticatedRequest` + `req.user` pattern,
 * so controllers do not need to depend on the Express request shape. Only
 * works on routes protected by `JwtAuthGuard` (which populates `req.user` via
 * the passport strategy).
 *
 * Usage:
 *   @Get('me')
 *   @UseGuards(JwtAuthGuard)
 *   me(@CurrentUser() user: AuthenticatedUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);
