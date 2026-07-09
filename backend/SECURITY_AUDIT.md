# Security Audit — Super Tic-Tac-Toe Backend

**Branch audited:** `backend/tictactoe-ws` (commit `8e199523`)
**Date:** 2026-07-09
**Scope:** All files under `backend/src/` + `backend/package.json`

---

## Summary

The backend is a minimal NestJS + Socket.io application with two WebSocket
game gateways (`minesweeper`, `super-tic-tac-toe`), no authentication, no
database, and no HTTP surface beyond a hello-world endpoint. The **game
engine logic is sound** — move validation is strict and a player cannot
cheat. The **critical risks are at the network/access layer**: no auth, no
rate limiting, no idle timeout, and a single global lobby that is trivially
DoS-able.

| Severity | Count |
|---|---|
| 🔴 Critical | 3 |
| 🟠 Medium | 4 |
| 🟡 Low / Informational | 5 |
| 🟢 Good (things done right) | 5 |

---

## 🔴 Critical

### C1 — No authentication on WebSocket connections

**Files:** `src/minesweeper/minesweeper.gateway.ts`, `src/superttt/superttt.gateway.ts`

Both gateways accept any connection. There is no JWT, no session, no
handshake auth token. `handleConnection` seats clients on a first-come
basis using only the socket ID.

**Impact:** Any internet user can:
- Connect and occupy a seat indefinitely (no timeout — see C2)
- Play both sides by opening 2 connections
- Disrupt any game by connecting/disconnecting rapidly (triggers lobby
  reset, kicking the legitimate opponent)

**Fix:** Add a `JwtAuthGuard`-equivalent for WebSockets. Verify a JWT in
the handshake (`auth: { token }` or `query: { token }`), reject the
connection before seating if invalid. Stash `userId` in `client.data`.

```ts
@WebSocketGateway({
  namespace: 'super-tic-tac-toe',
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true },
})
export class SuperTttGateway implements OnGatewayConnection, OnGatewayDisconnect {
  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token ?? client.handshake.query.token;
    try {
      const payload = this.jwtService.verify(String(token));
      client.data.userId = payload.sub;
    } catch {
      client.emit('game:error', { reason: 'unauthorized' });
      client.disconnect(true);
      return;
    }
    // ... seat the client ...
  }
}
```

### C2 — No rate limiting or connection limiting

**Files:** both gateways, `src/main.ts`

There is no `@nestjs/throttler`, no socket.io rate limiter, and no cap on
concurrent connections per IP. The global `ThrottlerGuard` from the auth
branch was stripped.

**Impact:** An attacker can:
- Open thousands of WebSocket connections → memory exhaustion (DoS)
- Flood `game:move` messages at high rate → CPU burn (though the engine
  rejects invalid moves quickly, parsing still costs CPU)
- Exhaust the 2 seats per game permanently with idle connections

**Fix:**
1. Add `@nestjs/throttler` back + a socket.io rate limiter middleware
   (e.g. `socket.io-rate-limiter` or a custom `handleConnection` that
   tracks per-IP connection counts).
2. Cap concurrent connections per IP (e.g. 5) in `handleConnection`.
3. Reject `game:move` events faster than 10/sec (a human can't click that
   fast).

### C3 — No idle/inactivity timeout + single global lobby = permanent DoS

**Files:** both gateways

A seated player who never moves blocks the game indefinitely. The other
player can only leave (which resets the lobby). There is no server-side
timeout to auto-kick idle players.

Combined with the single global lobby (only 2 seats, first-come), an
attacker can hold both seats with idle connections and make the game
permanently unplayable for everyone.

**Impact:** Permanent DoS of the game with 2 idle connections.

**Fix:**
1. Add an inactivity timer per seat: if no move in 60s during `playing`,
   emit `game:error { reason: 'timeout' }` and disconnect the idle client.
2. Add a "ready" timeout during `waiting`: if player 1 connects and player
   2 doesn't arrive in 120s, auto-disconnect player 1.
3. **Long-term:** Implement multi-lobby support (the `lobby` query param is
   already logged but unused). Each lobby = independent game. This removes
   the single-point-of-failure.

---

## 🟠 Medium

### M1 — No `maxHttpBufferSize` limit on socket.io

**Files:** both gateway decorators

socket.io defaults to `maxHttpBufferSize: 1e6` (1MB). A malicious client
can send a 1MB JSON payload per message. The gateway accepts
`Partial<MovePayload>` (tiny), but the server still allocates ~1MB to
parse it before rejecting. With no rate limit (C2), this amplifies.

**Fix:** Add `maxHttpBufferSize: 1e4` (10KB) to the gateway options —
more than enough for `{ boardIdx, cellIdx }`:

```ts
@WebSocketGateway({
  namespace: 'super-tic-tac-toe',
  cors: { ... },
  maxHttpBufferSize: 1e4,
})
```

### M2 — Polling transport enabled by default

**Files:** both gateway decorators

socket.io defaults to `transports: ['polling', 'websocket']`. Polling
allows HTTP-level flooding (repeated long-poll requests) and is
unnecessary if the frontend uses `transports: ['websocket']` (the
minesweeper frontend already does — see `useMinesweeper.ts`).

**Fix:** Add `transports: ['websocket']` to the gateway options. This
eliminates the polling attack surface entirely.

### M3 — No env validation at boot

**Files:** `src/main.ts`

`main.ts` reads `process.env.PORT` directly with no validation. If
`FRONTEND_URL` is unset (used in gateway CORS), CORS defaults to
`localhost:3000`, which would block the real frontend in production. The
auth branch had `validateEnv` via `class-validator` that crashed the app
on missing config — this branch has nothing.

**Fix:** Add `ConfigModule.forRoot({ validate: validateEnv })` back (the
`src/config/env.validation.ts` file from the auth branch), or at minimum
crash if `FRONTEND_URL` is unset in production:

```ts
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL must be set in production');
}
```

### M4 — CORS `credentials: true` without origin guard

**Files:** both gateway decorators

`credentials: true` is set, and the origin is `process.env.FRONTEND_URL ?? 'http://localhost:3000'`. This is secure IF `FRONTEND_URL` is a specific origin. But if someone sets `FRONTEND_URL=*` in production, `credentials: true` + wildcard origin is a CORS vulnerability (browsers reject this combo, but misconfigured proxies might not).

**Fix:** Guard against wildcard + credentials in the gateway setup:

```ts
const corsOrigin = process.env.FRONTEND_URL ?? 'http://localhost:3000';
if (corsOrigin === '*' && process.env.NODE_ENV === 'production') {
  throw new Error('FRONTEND_URL=* is unsafe with credentials: true');
}
```

---

## 🟡 Low / Informational

### L1 — `app.listen(PORT)` binds to all interfaces (0.0.0.0)

**File:** `src/main.ts`

Fine for a containerized/reverse-proxied deploy (Caddy in front), but in
a bare-metal deploy the backend would be directly exposed. Should bind to
`localhost` and let the reverse proxy handle external traffic:

```ts
await app.listen(process.env.PORT ?? 3000, 'localhost');
```

### L2 — No security headers (helmet)

**File:** `src/main.ts`

The auth branch had `helmet` for HTTP headers. This branch has none. Not
critical since there's no real HTTP surface (just the WS upgrade + a
hello-world GET), but good practice if any HTTP routes are added later.

### L3 — `process.env` read at decorator-evaluation time

**Files:** both gateway decorators

`process.env.FRONTEND_URL` in the `@WebSocketGateway({ cors: { origin: ... } })`
decorator is evaluated when the module loads, not per-request. This is
fine in practice (env doesn't change at runtime), but means a config
change requires a restart. Not a vulnerability — just a deployment note.

### L4 — Lobby code logged but not validated

**Files:** both gateways (`handleConnection`)

`client.handshake.query.lobby` is logged but ignored. Since there's only
one lobby, this is fine. When multi-lobby support lands (C3 fix), this
will need validation: the lobby code must exist, be `WAITING`, and not be
full.

### L5 — Dependencies appear current (no `npm audit` run)

**File:** `package.json`

NestJS 11, socket.io 4.8, rxjs 7.8. No known critical CVEs in these
versions. Run `npm audit` in CI to catch future advisories.

---

## 🟢 Good (things done right)

### G1 — Engine move validation is strict and correct

**Files:** `src/superttt/engine/superttt.engine.ts`, `src/minesweeper/engine/minesweeper.engine.ts`

The engines validate every move thoroughly:
- Game not over (`this.over` flag)
- Correct player's turn (`player !== this.currentPlayer` → reject)
- Valid integer indices (`Number.isInteger`, bounds `0-8`)
- Constrained-board rule (superttt: `nextBoard` enforcement)
- Cell empty / board not won
- Flood-fill / win-line / draw detection all correct

A player **cannot** cheat by playing out of turn, playing in the wrong
board, or playing in a taken cell. The engine is the single source of
truth — the gateway trusts it, and the engine doesn't trust the client.

### G2 — Disconnect resets state cleanly

**Files:** both gateways (`handleDisconnect`)

On disconnect, the lobby resets (`seats = [null, null]`, new engine,
`status = 'waiting'`). The survivor is re-seated as player 1 and gets a
fresh `game:joined`. No stale state leaks between games.

### G3 — `game:joined` sends full snapshot (reconnect-safe)

**Files:** `src/superttt/superttt.gateway.ts`

The superttt gateway sends `this.engine.snapshot()` (full board state) on
`game:joined`. A reconnecting player renders the current state without
missing moves. The minesweeper gateway sends board dimensions only
(because each player has their own fresh board — no state to restore).

### G4 — Socket IDs are server-assigned (no forgery)

The `seats` array maps socket IDs to seats. socket.io assigns socket IDs
server-side; a client cannot forge another client's ID. Impersonation is
not possible with default socket.io config.

### G5 — `over` flag prevents post-game moves

**Files:** both engines

Once `over = true`, all further moves are rejected with "game is already
over". No replay attacks possible after a game ends.

---

## Priority remediation

If only 3 things get fixed, fix these:

1. **C1 (auth)** — Add JWT verification on WebSocket handshake. Without
   this, everything else is theater.
2. **C2 (rate limiting)** — Add connection-per-IP cap + message rate
   limit. Without this, the server is DoS-able in seconds.
3. **C3 (idle timeout + multi-lobby)** — Add a 60s inactivity timer during
   `playing` and a 120s ready timeout during `waiting`. Plan multi-lobby
   support to remove the single-point-of-failure.

M1 + M2 (maxHttpBufferSize + transports) are one-line fixes each and
should be done immediately as defense-in-depth.
