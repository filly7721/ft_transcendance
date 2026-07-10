import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
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
 *
 * Avatars are served by UploadsController (a dedicated JWT-guarded controller
 * at /api/uploads/avatars/:filename), NOT by express.static. This is more
 * reliable than useStaticAssets under the global /api prefix and lets us
 * require authentication for avatar access.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // helmet with a permissive img-src CSP so avatars served from the backend
  // origin (and data: URLs) load in the browser.
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

  app.setGlobalPrefix('api');

  // Translate known Prisma errors (P2002 unique, P2025 not-found) into proper
  // HTTP statuses globally, so services don't repeat try/catch boilerplate.
  app.useGlobalFilters(new PrismaExceptionFilter());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}`);
}

void bootstrap();
