import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Bootstrap the NestJS application.
 *
 * JWT_SECRET is required for C1 (WebSocket auth). The check runs AFTER
 * NestFactory.create() so ConfigModule has loaded .env into process.env.
 * Without this, every WS connection would be rejected and the games
 * would be unplayable — a clear boot error is better.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // ConfigModule has now loaded .env — verify JWT_SECRET is present.
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET is not set. Add it to your .env file (see .env.example).',
    );
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
