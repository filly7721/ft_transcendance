/**
 * The authenticated-user shape attached to `req.user` by the JWT strategy and
 * injected by the `@CurrentUser()` parameter decorator.
 *
 * Kept in `common/` because it is a shared contract referenced by both the
 * auth module (strategy, decorator) and feature controllers (users, games…).
 *
 * `id` is a UUID string (was an auto-increment integer).
 */
export interface AuthenticatedUser {
  id: string;
  login: string;
}
