/**
 * Payload encoded into the JWT.
 *
 * Kept minimal on purpose:
 * - `sub`:   the user id (JWT standard claim for the subject).
 * - `login`: the public username, handy for the frontend without an extra
 *            request. Do NOT put sensitive data (password hash, email, role)
 *            in the token: the JWT is only signed, not encrypted.
 */
export interface JwtPayload {
  sub: number;
  login: string;
}
