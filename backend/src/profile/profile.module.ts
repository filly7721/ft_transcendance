import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

/**
 * Profile feature module.
 *
 * Depends on the global `PrismaModule` (no explicit import needed — it is
 * `@Global()`). Uses `@nestjs/platform-express`'s `FileInterceptor` for
 * avatar uploads (no extra dependency needed — platform-express includes
 * multer support).
 *
 * Routes are under `@Controller('users')` alongside `UsersController`. The
 * static `/users/me` route (GET) is in UsersController; the parametric
 * `/users/:login` route (GET) is here. NestJS/Express matches static routes
 * first, so there's no conflict.
 */
@Module({
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
