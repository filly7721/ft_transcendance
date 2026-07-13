import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyGuard } from './guards/api-key.guard';

/**
 * API keys: minting/revoking them (JWT-guarded, `/api/keys`) and the guard
 * that consumes them (`ApiKeyGuard`, used by the public API module).
 *
 * Exports the service and the guard so PublicApiModule can protect its routes
 * without reaching into this module's internals.
 */
@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyGuard],
  exports: [ApiKeysService, ApiKeyGuard],
})
export class ApiKeysModule {}
