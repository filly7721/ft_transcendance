import { Module } from '@nestjs/common';
import { PublicApiController } from './public-api.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { LobbiesModule } from '../lobbies/lobbies.module';
import { ProfileModule } from '../profile/profile.module';

/**
 * The versioned public API (`/api/v1/*`).
 *
 * Deliberately owns no business logic: it is a thin, API-key-authenticated
 * façade over the services the app already uses (lobbies, profiles), so the
 * public surface and the frontend's routes can never drift apart in behaviour.
 *
 * ApiKeysModule supplies the guard; ThrottlerModule is global, so the per-key
 * throttler guard resolves its dependencies without an explicit import.
 */
@Module({
  imports: [ApiKeysModule, LobbiesModule, ProfileModule],
  controllers: [PublicApiController],
})
export class PublicApiModule {}
