import { Module } from '@nestjs/common';
import { AvatarsController } from './uploads.controller';

/**
 * Uploads module — serves avatar files via a dedicated controller.
 *
 * JWT-guarded (only authenticated users can fetch avatars). Uses a
 * controller instead of express.static for reliable routing under the
 * global /api prefix.
 */
@Module({
  controllers: [AvatarsController],
})
export class UploadsModule {}
