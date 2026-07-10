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
 *  - helmet:        secure HTTP headers.
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

  app.use(helmet());
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
