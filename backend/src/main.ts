import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

/**
 * Bootstrap the NestJS application.
 *
 * Global middleware/pipes applied here:
 *  - helmet:        secure HTTP headers (CSP configured to allow avatar images).
 *  - cookieParser:  required if/when we add httpOnly refresh-token cookies.
 *  - CORS:          restricted to the frontend origin (CORS_ORIGIN env var).
 *  - ValidationPipe: validate every incoming DTO, strip unknown properties
 *                   and reject them, and transform payloads to their typed
 *                   shapes.
 *  - Static assets: serve uploaded files (avatars) from /uploads.
 *
 * The app is typed as NestExpressApplication so we can use useStaticAssets()
 * for serving uploaded avatar files.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // helmet with a permissive img-src CSP so avatars served from the backend
  // origin (and data: URLs) load in the browser. Without this, helmet's
  // default CSP blocks cross-origin image loads and avatars don't render.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
        },
      },
    }),
  );
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api', {
    // Exclude /uploads from the /api prefix so avatar files are served at
    // /uploads/avatars/<file>.png (not /api/uploads/...). This matches the
    // avatarUrl stored in the DB and what the frontend constructs.
    exclude: ['/uploads/(.*)'],
  });

  // Serve uploaded files (avatars) at /uploads/* from the uploads/ dir.
  // The avatar URLs stored in the DB are relative paths like
  // "/uploads/avatars/<file>.png" — express.static serves them directly.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Translate known Prisma errors (P2002 unique, P2025 not-found) into proper
  // HTTP statuses globally, so services don't repeat try/catch boilerplate.
  app.useGlobalFilters(new PrismaExceptionFilter());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}`);
}

void bootstrap();
