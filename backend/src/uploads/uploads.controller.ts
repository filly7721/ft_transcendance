import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
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
 * Path traversal protection: the filename must match FILENAME_RE below,
 * which admits exactly the shape this app writes and nothing else. Only
 * files in the uploads/avatars/ directory are served.
 *
 * Route: GET /api/uploads/avatars/:filename
 * Returns: the image file with correct Content-Type (from extension).
 */
@Controller('uploads/avatars')
export class AvatarsController {
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'avatars');

  /**
   * Exactly the names ProfileController writes: `<userId>-<timestamp>.<ext>`.
   *
   * The dot is only allowed as the extension separator, which is what makes
   * `.` and `..` unrepresentable. The previous `^[\w.-]+$` accepted both —
   * not a traversal, since `/` was still excluded, but `GET .../avatars/..`
   * reached `statSync` on the uploads directory itself and set a
   * Content-Length off it before the read failed.
   */
  private static readonly FILENAME_RE = /^[\w-]+\.(png|jpe?g|webp)$/;

  /**
   * MIME types by extension (for the Content-Type header). Deliberately the
   * same three the upload side accepts (see ProfileController's EXT_BY_MIME):
   * an extension listed here that cannot be uploaded is either dead or a way
   * to serve a file that arrived by some other route.
   */
  private readonly mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };

  @Get(':filename')
  serveAvatar(@Param('filename') filename: string, @Res() res: Response): void {
    // Sanitize the filename to prevent path traversal (../../etc/passwd etc.)
    if (!AvatarsController.FILENAME_RE.test(filename)) {
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
