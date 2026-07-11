import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Serves uploaded avatar files.
 *
 * PUBLIC endpoint (NO JWT guard): avatars are public assets, like social
 * media profile pictures. The <img> tag in the browser cannot send an
 * Authorization header, so a JWT-guarded avatar endpoint would always 401.
 *
 * Path traversal protection: the filename is validated to only allow
 * alphanumeric, dashes, underscores, and dots — so `../../etc/passwd` is
 * rejected. Only files in the uploads/avatars/ directory are served.
 *
 * Route: GET /api/uploads/avatars/:filename
 * Returns: the image file with correct Content-Type (from extension).
 */
@Controller('uploads/avatars')
export class AvatarsController {
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'avatars');

  /** MIME types by extension (for Content-Type header). */
  private readonly mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };

  @Get(':filename')
  serveAvatar(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): void {
    // Sanitize the filename to prevent path traversal (../../etc/passwd etc.)
    if (!/^[\w.-]+$/.test(filename)) {
      throw new NotFoundException('invalid filename');
    }

    const filePath = join(this.uploadsDir, filename);
    if (!existsSync(filePath)) {
      throw new NotFoundException(`avatar '${filename}' not found`);
    }

    // Set Content-Type from the file extension.
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const contentType = this.mimeTypes[ext] ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const stat = statSync(filePath);
    res.setHeader('Content-Length', stat.size);

    const stream = createReadStream(filePath);
    stream.on('error', () => {
      // Throwing here would escape Nest's request pipeline (we're in a
      // stream callback) and crash the process as an uncaught exception.
      // Answer on the response object directly instead.
      if (!res.headersSent) {
        res.status(404);
      }
      res.end();
    });
    stream.pipe(res);
  }
}
