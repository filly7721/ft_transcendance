import { config as loadEnvFile } from 'dotenv';

/**
 * The frontend's origin, read from the environment in ONE place.
 *
 * Four websocket gateways and the HTTP CORS setup in main.ts all need to know
 * where the browser talks to us from. That used to be two env vars with the
 * same value (CORS_ORIGIN for HTTP, FRONTEND_URL for the gateways) and five
 * copies of the `?? 'http://localhost:3000'` fallback, so moving the app to a
 * new host meant editing the URL twice and hoping neither copy was missed.
 * There is one variable now, FRONTEND_URL, read here and imported everywhere.
 *
 * .env has to be loaded here rather than left to ConfigModule: a
 * `@WebSocketGateway({ cors: { origin: ... } })` decorator is evaluated when
 * its file is first imported, which happens while AppModule's imports are
 * being resolved — i.e. BEFORE ConfigModule.forRoot() runs and copies .env
 * into process.env. Anything a gateway reads at decoration time therefore has
 * to come from an env file that is already loaded. dotenv never overwrites a
 * variable that is already set, so a real environment variable (Docker, CI, a
 * `FRONTEND_URL=... npm start`) still wins over the .env file, and
 * ConfigModule loading the same file again later is a no-op.
 */
loadEnvFile({ quiet: true });

export const FRONTEND_ORIGIN =
  process.env.FRONTEND_URL ?? 'http://localhost:3000';
