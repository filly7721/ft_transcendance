import { ValidationPipe, Logger, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { API_KEY_HEADER } from './api-keys/guards/api-key.guard';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

/**
 * Mount the OpenAPI docs at `/api/docs` (JSON at `/api/docs-json`).
 *
 * Two auth schemes are declared because the API has two front doors: you sign
 * in with a JWT to mint a key (`/api/keys`), then call the public API with
 * that key (`/api/v1/*`). Swagger UI's "Authorize" button offers both, so the
 * whole flow is exercisable from the browser without any other tooling.
 */
function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('ARCADE public API')
    .setDescription(
      'Programmatic access to ARCADE lobbies and player profiles.\n\n' +
        '**Getting a key:** sign in, then `POST /api/keys` with a name. The ' +
        'raw key is returned exactly once — store it; only its hash is kept.\n\n' +
        '**Calling the API:** send it as the `X-API-Key` header on any ' +
        '`/api/v1/*` route. A key acts as the account that minted it.\n\n' +
        '**Rate limit:** 100 requests per minute, counted per key.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt', // matches @ApiBearerAuth('jwt') on the key-management routes
    )
    .addApiKey(
      { type: 'apiKey', name: API_KEY_HEADER, in: 'header' },
      'api-key', // matches @ApiSecurity('api-key') on the public API
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}

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

  // helmet with:
  //  - permissive img-src CSP so avatars served from the backend origin load
  //  - crossOriginResourcePolicy: 'cross-origin' so the browser allows
  //    cross-origin image loads (frontend on :3000 fetches avatars from :3001).
  //    Helmet's default is 'same-origin' which blocks <img> tags from loading
  //    cross-origin images even when CORS is configured — the browser returns
  //    net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin.
  const secureHeaders = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'http:', 'https:'],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // Swagger UI bootstraps itself with an inline <script> and inline styles,
  // which the strict CSP above blocks. Rather than punching 'unsafe-inline'
  // into the whole app's policy, relax it only on the docs route — a static
  // page that renders no user data and takes no user input.
  const docsHeaders = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const handler = req.path.startsWith('/api/docs')
      ? docsHeaders
      : secureHeaders;
    handler(req, res, next);
  });
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

  // After setGlobalPrefix so the documented paths carry the /api prefix.
  setupSwagger(app);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}`);
  logger.log(`API docs on http://localhost:${port}/api/docs`);
}

void bootstrap();
