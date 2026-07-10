import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Throttle } from '@nestjs/throttler';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

/** Allowed avatar MIME types. */
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Profile endpoints.
 *
 * - `PATCH /users/me`          -> update displayName / avatarUrl (JWT).
 * - `POST  /users/me/avatar`   -> upload avatar file (JWT, multipart/form-data).
 * - `GET   /users/:login`      -> public profile + stats (JWT, no email leaked).
 *
 * All routes are JWT-guarded: even public profiles require authentication to
 * prevent user enumeration by anonymous visitors.
 *
 * Routing note: `GET /users/me` is in `UsersController`. NestJS/Express
 * matches static routes before parametric ones, so `GET /users/me` wins over
 * `GET /users/:login` even though both controllers use `@Controller('users')`.
 * Logins are 3-20 chars (letters/digits/_-), so 'me' is never a valid login.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Patch('me')
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 updates / min / IP
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profile.updateProfile(user.id, dto);
  }

  @Post('me/avatar')
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 uploads / min / IP
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/avatars',
        filename: (req, file, cb) => {
          const userId = (req.user as { id?: string })?.id ?? 'unknown';
          const ext = extname(file.originalname) || '.png';
          cb(null, `${userId}-${Date.now()}${ext}`);
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
      },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          cb(
            new Error(
              `invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME.join(', ')}`,
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ avatarUrl: string }> {
    if (!file) {
      throw new Error('no file uploaded');
    }
    return this.profile.saveAvatarUrl(user.id, file.filename);
  }

  @Get(':login')
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // 30 lookups / min / IP
  getPublicProfile(@Param('login') login: string) {
    return this.profile.getPublicProfile(login);
  }
}
