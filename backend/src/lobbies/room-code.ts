import { randomInt } from 'crypto';

/**
 * Generates a room code: exactly 9 random digits separated by dashes in the
 * format `xxx-xxx-xxx` (e.g. `482-137-905`).
 *
 * Uses `crypto.randomInt` (not `Math.random`) because the room code acts as a
 * secret — a player needs it to join via "JOIN BY CODE". Cryptographic
 * randomness prevents guessing.
 *
 * The code space is 10^9 (1 billion) possibilities, so collisions are
 * astronomically unlikely; the service retries on collision anyway.
 */
export function generateRoomCode(): string {
  const part = () => randomInt(0, 1000).toString().padStart(3, '0');
  return `${part()}-${part()}-${part()}`;
}
