*This project has been created as part of the 42 curriculum by ashalaab, ssiddiqu, lalwafi, aal-hawa.*

# ARCADE

## Description

**ARCADE** is a real-time multiplayer arcade platform. Two players find each other
through a lobby with a shareable room code, then play in the browser over a WebSocket
connection while chatting with friends from the same page.

The goal was one coherent product rather than a pile of features: a social layer
(accounts, profiles, friends, presence, direct messages) that games plug into, so a
match always has a person on the other side of it.

Two games ship with it:

- **Minesweeper Versus.** Both players race the same minefield. Boards are generated
  to be solvable by pure deduction, so a match is decided by speed rather than by a
  coin flip, and the opponent's progress is visible only as fog.
- **Super Tic-Tac-Toe.** Nine boards in a 3x3 grid. Your move dictates which board the
  opponent must play in next.

### Key features

- **Accounts.** Email and password signup, bcrypt-hashed and salted, JWT sessions used
  for both HTTP and WebSocket connections.
- **Profiles.** Editable display name and login, avatar upload with a generated
  default, public profile pages that never expose an email address.
- **Friends and presence.** Send, accept, reject, unfriend, block, and see who is
  online.
- **Direct messages.** Real-time chat between friends with typing indicators, read
  receipts, persisted history and unread badges.
- **Game lobbies.** Create or join a room with a nine-digit `xxx-xxx-xxx` code, or
  browse open lobbies.
- **Live 1v1 gameplay.** Two players on separate machines, seats held by user id, so a
  refresh or a dropped connection resumes the game instead of forfeiting it.
- **Game statistics.** Win, loss and draw counts per game, recorded on every finished
  match and shown on profiles, in Settings and in the friends list.
- **Public API.** A versioned `/api/v1` surface with API-key auth, per-key rate
  limiting and interactive OpenAPI documentation.
- **Custom design system.** A CRT arcade cabinet look built from a documented palette,
  21 hand-drawn pixel icons and a set of shared components, rendered live at `/design`.
- **Security hardening.** TLS at the edge, JWT on every socket, per-IP connection caps,
  per-socket message limits, per-route rate limits, idle timeouts and strict upload
  validation.

## Instructions

### Prerequisites

| Requirement | Version |
|---|---|
| Docker Engine | >= 24 with Compose v2 |
| Google Chrome, Firefox, Safari or Edge | latest stable |

Node.js is only needed if you want to run the services outside containers.

### Installation and running

```bash
git clone https://github.com/filly7721/ft_transcendance
cd ft_transcendance

cp .env.example .env

# Fill in the two secrets it asks for. The backend refuses to boot without a real
# JWT_SECRET, so these are not optional.
openssl rand -hex 16   # -> POSTGRES_PASSWORD
openssl rand -hex 32   # -> JWT_SECRET

docker compose up --build
```

That one command brings up four containers: nginx terminating TLS, the Next.js
frontend, the NestJS backend, and PostgreSQL. Prisma migrations are applied by the
backend entrypoint before it starts listening, so a first run reaches the current
schema on its own.

Open **`https://localhost`**. The certificate is self-signed and generated on first
boot, so accept the browser warning once.

### Deployment architecture

Everything is served from one origin, so there is no CORS to configure and one
certificate covers the whole app.

```
  browser ──https──▶  nginx :443 (:80 → 301)        ← the only published port
                          │
            ┌─────────────┴─────────────┐
            │ /                         │ /api  and  /socket.io/
            ▼                           ▼
      frontend:3000               backend:3001 ──▶ db:5432
```

nginx terminates TLS and routes by path. `/socket.io/` needs its own block because the
gateways are websocket-only, with no long-polling fallback to degrade to. The frontend
and backend are reachable only on the internal network, and Postgres publishes to
loopback so local development can reach it without exposing it to the LAN. Three named
volumes survive `docker compose down`: `pgdata`, `uploads` (avatars are files, not rows)
and `certs`.

### Environment variables

Every `.env` is git-ignored, with a committed `.env.example` beside it. The root
`.env` is the one Compose reads; the per-service files are only used when running
outside containers.

**`.env`** (the container stack)

| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | database password, used to build `DATABASE_URL` |
| `JWT_SECRET` | session and WebSocket token signing key, 32 characters minimum |
| `JWT_EXPIRES_IN` | token lifetime, defaults to `7d` |
| `PUBLIC_ORIGIN` | the single origin everything is served from, defaults to `https://localhost` |

`PUBLIC_ORIGIN` is the allowed CORS origin, the WebSocket origin, and the API base
compiled into the frontend bundle. Because `NEXT_PUBLIC_*` values are inlined at
build time, changing it needs `docker compose up --build`, not just a restart. To
serve over the LAN, set it to the host's address (for example `https://10.18.200.149`)
and rebuild.

**`backend/.env`** (bare-metal runs only)

| Variable | Purpose |
|---|---|
| `PORT` | backend port, defaults to `3001` |
| `NODE_ENV` | `development` or `production` |
| `DATABASE_URL` | PostgreSQL connection URL |
| `JWT_SECRET` | as above |
| `JWT_EXPIRES_IN` | as above |
| `FRONTEND_URL` | the single allowed origin for CORS and all four gateways |
| `TRUST_PROXY` | `true` only behind a proxy you control; the stack sets it |

**`frontend/.env.local`** (bare-metal runs only)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | backend origin as seen by the browser |

### Running without Docker

Postgres is the database either way, so the `db` container still has to be up. Compose
publishes it on loopback for exactly this, which means the root `.env` is needed even
when the app itself runs on the host.

```bash
cp .env.example .env                        # POSTGRES_PASSWORD starts the database
docker compose up -d db

npm install
npm install --prefix backend
npm install --prefix frontend

cp backend/.env.example backend/.env        # set JWT_SECRET and the password
cp frontend/.env.example frontend/.env.local

cd backend && npx prisma migrate deploy && cd ..
npm run dev                                 # both services in watch mode, :3000 and :3001
```

`DATABASE_URL` in `backend/.env` has to carry the same password as the root `.env`:
`postgresql://arcade:<POSTGRES_PASSWORD>@localhost:5432/arcade`.

Two things that will otherwise cost you an afternoon. Run Prisma from `backend/` rather
than the repo root: the CLI is a local dependency there, and `npx` at the root fetches a
newer major version that rejects this schema outright. And this path serves plain HTTP on
`:3000`, so use the container stack for anything that has to demonstrate HTTPS.

### Using the public API

Interactive documentation, with both auth schemes wired into the Authorize button, is
at **`https://localhost/api/docs`**.

The Settings page has an API KEY panel that mints a key, shows the secret once and
revokes it. Each account may hold one active key at a time. The same flow over HTTP:

```bash
# 1. Sign in for a session token.
TOKEN=$(curl -s -X POST https://localhost/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"YourPassw0rd"}' | jq -r .accessToken)

# 2. Mint a key. The raw value is returned exactly once; only its hash is stored.
KEY=$(curl -s -X POST https://localhost/api/keys \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"my bot"}' | jq -r .key)

# 3. Call the public API. 100 requests per minute, counted per key.
curl -s https://localhost/api/v1/me -H "X-API-Key: $KEY"

curl -s -X POST https://localhost/api/v1/lobbies -H "X-API-Key: $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"game":"super-tic-tac-toe","name":"bot lobby","maxPlayers":2}'

curl -s "https://localhost/api/v1/lobbies?game=super-tic-tac-toe" -H "X-API-Key: $KEY"
curl -s -X PUT    https://localhost/api/v1/lobbies/123-456-789 -H "X-API-Key: $KEY" \
  -H 'Content-Type: application/json' -d '{"name":"renamed"}'
curl -s -X DELETE https://localhost/api/v1/lobbies/123-456-789 -H "X-API-Key: $KEY"
```

## Team Information

| Login | Role(s) | Responsibilities |
|---|---|---|
| **ashalaab** | Tech Lead, Developer | Technical architecture and stack decisions, project structure, code review, the integration layer between games, lobbies and accounts, containerisation and TLS |
| **ssiddiqu** | Product Owner, Developer | Feature scope and prioritisation, validating completed work, Super Tic-Tac-Toe client, quality and security passes |
| **aal-hawa** | Project Manager, Developer | Planning and sequencing, progress tracking, backend and database ownership |
| **lalwafi** | Developer | Minesweeper client, lobby and room wiring, responsive and cross-browser work |

## Project Management

176 commits across 45 days, from 4 July to 18 August 2026.

| Login | Commits |
|---|---|
| ashalaab | 72 |
| lalwafi | 38 |
| ssiddiqu | 34 |
| aal-hawa | 29 |

**Work division.** Split by layer. **aal-hawa** owned the backend and the database.
**ssiddiqu** and **lalwafi** owned the frontend, one game client each. **ashalaab**
worked across both and owned the project structure, the integration points where the
two layers meet, and the technical decisions. Crossover happened where it was cheaper
than a handoff: ssiddiqu wrote the Minesweeper board generator on the server, and
aal-hawa built the social UI alongside the modules feeding it.

Because each game had its engine on one side of that split and its client on the
other, both games have an explicit wire protocol as their contract
(`superTttProtocol.ts`, `minesweeper/lib/protocol.ts`) rather than a shared assumption.

**Branching.** Short-lived feature branches merged into `master`, named after the work
rather than the person: `frontend-structure`, `backend/auth`, `backend/tictactoe-ws`,
`frontend-authentication`, `superttt-online`, `feature/profile-friends-chat`,
`feature/lobbies`, `feature/game-stats`, `improvements`. Twelve merge commits record
where each landed. `feature/lobbies` was pair work between ashalaab and lalwafi.

**Sequencing.** Scaffolding and the app shell (4 to 6 July), authentication and the two
game engines (7 to 9 July), the social layer in five numbered phases (10 July),
lobbies and rooms tying games to accounts (11 to 13 July), the public API and design
system (13 July), then a correctness and security pass, statistics, legal pages, a
responsive pass and cross-browser testing (11 to 18 August).

**Conventions.** Conventional-commit prefixes (`feat`, `fix`, `refactor`, `perf`,
`chore`, `docs`, `security`) with a scope, and a subject stating what the change does
for a user rather than which files moved.

**Code review.** Feature branches were reviewed before merge. The August work is
largely one member auditing another's module: the correctness runs on 11 July and 13
August cover chat, friends, profile, social and lobbies written by someone else.

**Tools.** GitHub for issues, pull requests and review. Discord for day-to-day
coordination, with a weekly sync.

## Technical Stack

### Frontend

| Choice | Justification |
|---|---|
| **Next.js 16**, App Router | Route groups give the three page shells this app needs (auth split-screen, sidebar layout, bare public pages) with no router configuration |
| **React 19** | Required by Next 16 |
| **TypeScript 5** | The wire protocols are the seam between two people's work, so they need to be checked rather than remembered |
| **Tailwind CSS 4** | The design system lives in `@theme` tokens in one stylesheet, so the neon treatments stay consistent without a parallel class hierarchy |
| **Socket.IO client 4.8** | Matches the server, and its reconnection handling is why a refresh mid-game resumes rather than forfeits |
| **React Context** | Session and toast state are the only genuinely global state; everything else is local or derived during render, so a state library would be dead weight |

### Backend

| Choice | Justification |
|---|---|
| **NestJS 11** on Express | Modules and dependency injection make boundaries explicit when several people add modules in parallel. Gateways and controllers share one lifecycle, so a socket reuses the same JWT verification as an HTTP route |
| **Prisma 5.22** | Typed queries generated from one schema file, plus a real migration history |
| **PostgreSQL 16**, everywhere | One engine for development and deployment. Prisma takes `provider` as a static literal rather than an `env()` call, and a migration history is dialect-specific either way, so two engines would have meant maintaining two migration histories. The schema still uses only portable types (no enums, no native arrays, status fields are plain strings) |
| **JWT** and **bcrypt** | One token proves identity to both the HTTP API and all four gateways, so there is a single place authentication can be wrong |
| **Socket.IO 4.8** | Rooms are exactly the primitive needed: a lobby room per code, a per-user room for targeted delivery, a namespace per gateway |
| **class-validator** | Validation declared on the DTO next to the type, enforced globally with `whitelist` and `forbidNonWhitelisted`, so unknown properties are rejected rather than ignored |
| **@nestjs/swagger** | The public API is only worth claiming if an integrator can use it without reading the source |
| **@nestjs/throttler**, **helmet** | Per-route rate limits and secure headers, with the throttler subclassed to bucket the public API per key instead of per IP |
| **nginx** | Terminates TLS in front of both services, so no application code handles certificates |
| **Docker Compose** | Four services from one command. `prisma migrate deploy` runs on the backend entrypoint, so a fresh clone reaches the current schema with no manual step |

## Database Schema

Seven models. `users` is the hub: every other table hangs off it, and every foreign key
to it cascades on delete, so deleting an account removes its lobbies, memberships,
friendships, messages, results and API keys with it.

```
                                 ┌───────────────┐
                                 │     users     │
                                 └───┬───┬───┬───┘
             ┌───────────────────────┘   │   └──────────────────────┐
             │ hostId                    │                          │ userId
             ▼                           │                          ▼
      ┌─────────────┐                    │                   ┌─────────────┐
      │   lobbies   │                    │                   │  api_keys   │
      └──────┬──────┘                    │                   └─────────────┘
             │ lobbyId                   │
             ▼                           ├── requesterId ──┐
   ┌───────────────────┐                 ├── addresseeId ──┴─▶ friendships
   │   lobby_members   │◀── userId ──────┤
   └───────────────────┘                 ├── senderId ─────┐
                                         ├── receiverId ───┴─▶ messages
                                         │
                                         └── userId ─────────▶ game_results
```

| Relation | Cardinality | Notes |
|---|---|---|
| `users` → `lobbies` | 1:N via `hostId` | one host per lobby |
| `users` → `lobby_members` | 1:N via `userId` | `UNIQUE (lobbyId, userId)` prevents double-joining |
| `lobbies` → `lobby_members` | 1:N via `lobbyId` | membership rows are the seats |
| `users` → `friendships` | 1:N twice, as `requesterId` and `addresseeId` | one row per relationship, not two |
| `users` → `messages` | 1:N twice, as `senderId` and `receiverId` | |
| `users` → `game_results` | 1:N via `userId` | one row per player per finished match |
| `users` → `api_keys` | 1:N via `userId` | at most one un-revoked row per user |

### Fields

```
users                                    api_keys
  id            String    PK  uuid         id          String    PK  uuid
  email         String    UNIQUE           userId      String    FK
  login         String    UNIQUE           name        String
  displayName   String    "Player"         keyHash     String    UNIQUE  sha-256
  passwordHash  String    bcrypt           prefix      String    display only
  avatarUrl     String?   null = default   lastUsedAt  DateTime?
  createdAt     DateTime                   revokedAt   DateTime? kept as audit trail
  updatedAt     DateTime                   createdAt   DateTime

lobbies                                  lobby_members
  id          String   PK = room code      id        Int       PK
  game        String                       lobbyId   String    FK
  name        String                       userId    String    FK
  hostId      String   FK                  joinedAt  DateTime
  maxPlayers  Int      validated to 2      UNIQUE (lobbyId, userId)
  options     String   json blob
  status      String   "WAITING"
  createdAt   DateTime
  updatedAt   DateTime

friendships                              messages
  id           Int       PK                id          Int       PK
  requesterId  String    FK                senderId    String    FK
  addresseeId  String    FK                receiverId  String    FK
  status       String    PENDING |         content     String
                         ACCEPTED |        readAt      DateTime? null = unread
                         BLOCKED           createdAt   DateTime
  createdAt    DateTime                    INDEX (receiverId, readAt)
  updatedAt    DateTime                    INDEX (senderId, receiverId)
  UNIQUE (requesterId, addresseeId)
  INDEX (addresseeId, status)

game_results
  id        Int       PK
  userId    String    FK
  game      String    "minesweeper" | "super-tic-tac-toe"
  result    String    "win" | "loss" | "draw"
  score     Int?      time to clear, or move count
  playedAt  DateTime
  INDEX (userId, game), INDEX (game, result)
```

Two decisions worth noting. A friendship is **one row, not two**: the unique constraint
makes a duplicate request impossible at the database level, and the row's direction is
what lets the addressee accept, reject or block. And a lobby's **primary key is its
room code**, since a lobby is only ever addressed by the code a player types.

## Features List

| Feature | Description | Implemented by |
|---|---|---|
| Project structure | Monorepo, both framework setups, route groups, Docker and nginx TLS | ashalaab |
| Application shell | Top bar, sidebar, user menu, footer, per-section layouts | ashalaab |
| Registration and login | Email and password, bcrypt-hashed and salted, JWT issued for HTTP and WebSocket use | aal-hawa |
| Session handling | Token storage, `apiFetch` wrapper injecting the token, session context, route guard | ashalaab |
| UUID user ids | Migrated from auto-increment integers so ids are not enumerable | aal-hawa |
| Account deletion | Removes the account and cascades every dependent row | aal-hawa, ssiddiqu |
| Profile viewing | Public profile page with stats, never exposing an email | aal-hawa |
| Profile editing | Change display name and login, with the JWT reissued on a login change | aal-hawa, ssiddiqu |
| Avatar upload | PNG, JPEG and WebP, 2 MB cap, extension taken from the sniffed MIME type rather than the client filename, generated default when unset | aal-hawa, ssiddiqu |
| Friend requests | Send, accept, reject and unfriend, with a real-time decline notice | aal-hawa |
| Blocking | Ends the friendship, stops messages both directions, hides both users' lobbies from each other | ssiddiqu |
| Online presence | Real-time status over a dedicated social socket | aal-hawa |
| Direct messaging | Friend-only real-time chat with persisted, cursor-paginated history | aal-hawa |
| Typing indicators and read receipts | Throttled client-side, rate-limited server-side, `readAt` reported back to the sender | aal-hawa |
| Unread badges | Live counts in the sidebar and chat widget | aal-hawa |
| Lobby browser | List, create, join, or join by code, per game | ashalaab, lalwafi |
| Room codes | `xxx-xxx-xxx` generator, used directly as the lobby primary key | aal-hawa |
| Two-player cap and auto-leave | `maxPlayers` validated to exactly 2; creating or joining a lobby exits the previous one | ssiddiqu, ashalaab |
| Minesweeper engine and gateway | Pure reveal, flag and cascade logic; room-scoped versus sessions with a three-second countdown and a shared opening | ashalaab |
| Guess-free boards and fog | Deduction-only solver used as a generation filter, so no race is decided by a 50/50; the opponent's progress reads as shape, not information | ssiddiqu |
| Minesweeper client | Wire protocol, socket hook, presentational board, versus view, tap-to-flag toggle | lalwafi |
| Super Tic-Tac-Toe engine and gateway | Constrained-board rule, win and draw detection, strict server-side move validation | aal-hawa |
| Super Tic-Tac-Toe client | Rules mirror, wire protocol, socket hook, board component, active-board and last-move highlighting | ssiddiqu, ashalaab |
| Disconnect and resume | Seats keyed by user id, games survive a refresh, duplicate windows superseded, opponent shown a DISCONNECTED indicator | ashalaab, lalwafi |
| Game results and statistics | A row per player per finished match, aggregated into win, loss and draw counts on profiles, in Settings and in the friends list | aal-hawa |
| Public API | `/api/v1`, seven endpoints, all four verbs, API-key auth, OpenAPI docs | ashalaab |
| API key management | Mint, list and revoke, one active key per account, hash-only storage, Settings panel | ashalaab, ssiddiqu |
| Design system | 13 colour tokens, 21 pixel icons, 19 shared components, `/design` reference page | ashalaab |
| Privacy Policy and Terms | Public `/privacy` and `/terms`, written against what the schema stores, linked from the footer | ssiddiqu |
| Notification toasts | Global provider for friend requests, declines and errors | aal-hawa |
| Responsive layout | Mobile navigation drawer, thumb-sized controls, boards that shrink, single-pane chat, wrapped lobby forms, no iOS zoom on focus, reduced-motion support | lalwafi |
| Cross-browser support | Tested and fixed on Firefox, Safari and Edge alongside Chrome | lalwafi |
| Security hardening | TLS at the edge, JWT on every socket, per-IP connection caps scoped per namespace, per-socket message limits, per-route rate limits, 30-minute chat idle timeout, no trust in spoofed client IPs, helmet | ssiddiqu, aal-hawa |
| Realtime performance | Sockets addressed by user room instead of scanning connections; socket events applied to local state instead of refetching REST | ashalaab, ssiddiqu, lalwafi |

## Modules

### Mandatory part

| Requirement | Status |
|---|---|
| Web application with frontend, backend and database | Done |
| Git with clear commit messages and work split across the team | Done, 176 commits, four contributors |
| Containerised deployment in a single command | Done, `docker compose up --build` |
| Compatible with the latest stable Google Chrome | Done |
| No JavaScript warnings or errors in the browser console | Done |
| Accessible Privacy Policy and Terms of Service pages | Done, `/privacy` and `/terms`, linked from the footer |
| Multi-user support, concurrent and real-time | Done |
| CSS framework or styling solution | Done, Tailwind CSS 4 |
| Credentials in a git-ignored `.env` with a committed `.env.example` | Done, root and both services |
| Clear database schema with well-defined relations | Done, Prisma, seven models, migration history |
| Secure signup and login, hashed and salted | Done, bcrypt and JWT |
| Form validation on both frontend and backend | Done, `ValidationPipe` with `whitelist` and `forbidNonWhitelisted`, plus client-side checks |
| HTTPS for every connection to the backend | Done, TLS terminated at nginx |

### Chosen modules: 17 points

| Module | Type | Points | Owner |
|---|---|---|---|
| Framework for both frontend and backend | Major | 2 | ashalaab |
| Real-time features over WebSockets | Major | 2 | ashalaab, aal-hawa |
| Users interact: chat, profiles, friends | Major | 2 | aal-hawa |
| Standard user management and authentication | Major | 2 | aal-hawa, ssiddiqu |
| A complete web-based game | Major | 2 | ssiddiqu, aal-hawa |
| Remote players on separate machines | Major | 2 | ashalaab, lalwafi |
| Public API with a secured key, rate limiting and documentation | Major | 2 | ashalaab |
| ORM for the database | Minor | 1 | aal-hawa |
| Custom-made design system | Minor | 1 | ashalaab |
| Support for additional browsers | Minor | 1 | lalwafi |
| **Total** | | **17** | |

#### Framework for both frontend and backend (Major, 2)

Next.js 16 with the App Router, NestJS 11 on the backend. Both are used for what makes
them frameworks: Next's route groups give three page shells with no router config, and
Nest's module system with dependency injection is what keeps fourteen feature modules
from reaching into each other. Two circular dependencies between the friends and social
modules were caught and fixed only because the injector refused them at boot.

#### Real-time features over WebSockets (Major, 2)

Four Socket.IO gateways: `minesweeper`, `superttt`, `chat` and `social`.

- **Updates across clients.** Eight inbound message types and seventeen outbound
  events cover moves, board updates, countdowns, game-over, presence, friend requests,
  typing, delivery and read receipts, and live profile changes.
- **Connection handling.** Every gateway verifies the handshake JWT before seating a
  client. Seats are held by user id rather than socket id, so a refresh reclaims the
  same seat and the game resumes from authoritative server state. A second window for
  the same user supersedes the first rather than stealing the seat. Empty rooms are
  torn down on a timer.
- **Efficient broadcasting.** Delivery is addressed to per-user and lobby rooms rather
  than by iterating connected sockets. Clients apply socket events to local state
  instead of refetching REST, which removed a burst of `429`s under normal play.

#### Users interact (Major, 2)

Chat, profiles and friends. Direct messages are persisted with cursor-paginated
history and delivered to every tab the recipient has open. Profiles are served from
`GET /users/:login` with `email` excluded at the service layer rather than filtered in
the component. Friends covers request, accept, reject, unfriend and block with live
status.

The interesting part is authorisation: messaging and history both require an `ACCEPTED`
friendship row, checked server-side on every send and every read, so removing a friend
closes the conversation in both directions immediately.

#### Standard user management and authentication (Major, 2)

Users update their own profile, including their login, which reissues the JWT so the
session cannot refer to a name that no longer exists. Avatar upload is capped at 2 MB
and restricted to PNG, JPEG and WebP, with the stored extension taken from the sniffed
MIME type rather than the client filename, so an upload cannot claim to be a PNG and
land as something else. A default avatar is generated from the login when none is set.
Friends carry live online status, and every user has a profile page reachable from chat
and the friends list.

#### A complete web-based game (Major, 2)

**Super Tic-Tac-Toe**, real-time and 1v1. Nine 3x3 boards in a 3x3 grid; the cell you
play dictates which board your opponent must play in, and if that board is finished
they may play anywhere. Win three mini-boards in a line to win the match.

Both clients hold a mirror of the rules for instant feedback, but the server engine is
authoritative and validates every move against its own state, so a tampered client is
rejected rather than trusted. Win, loss and draw are all detected server-side,
announced through `game:over`, then written to `game_results`.

#### Remote players (Major, 2)

Two players on separate machines, coordinated only by a room code.

- **Latency.** Moves are sent as intents and confirmed by an authoritative server
  update, so no client renders a move the server has not accepted.
- **Disconnections.** Seats are keyed by user id, not socket id. A dropped connection
  keeps the seat, the opponent sees a DISCONNECTED badge, and the reconnecting player
  is restored from a state snapshot rather than a replay of move history.
- **Reconnection.** Socket.IO reconnection plus back-forward-cache handling, with the
  room code travelling in the handshake `auth` payload so a reconnect rejoins the right
  room without a round trip.

#### Public API (Major, 2)

A versioned, key-authenticated surface at `/api/v1`, kept separate from the routes the
frontend uses so an internal refactor cannot break an integration.

- **Secured key.** `POST /api/keys` (JWT-guarded) mints a key. The raw value is
  returned exactly once and only its SHA-256 hash is stored, so a database leak yields
  nothing replayable. Keys are revocable, revoked rows are retained as an audit trail,
  and a key acts strictly as its owner, so a leak cannot escalate past one account.
- **Rate limiting.** 100 requests per minute bucketed per key by
  `ApiKeyThrottlerGuard`, not per IP. Per-IP would let callers behind one NAT exhaust
  each other's budget while letting one caller dodge the limit by rotating addresses.
- **Documentation.** OpenAPI 3 at `/api/docs`, with both auth schemes wired to the
  Authorize button so the whole mint-then-call flow is exercisable in a browser.
- **Seven endpoints, all four verbs.** `GET /v1/me`, `GET /v1/lobbies`,
  `POST /v1/lobbies`, `GET /v1/lobbies/:code`, `PUT /v1/lobbies/:code`,
  `DELETE /v1/lobbies/:code`, `GET /v1/players/:login`. Editing a lobby you do not host
  returns `404` rather than `403`, so the API never confirms a room code belongs to
  someone else.

#### ORM for the database (Minor, 1)

Prisma 5.22. One `schema.prisma` is the single source of truth for the seven models,
their relations, cascade behaviour and indexes, and the client is generated from it, so
a query that does not match the schema fails at compile time. The migration history is
committed, so any checkout reaches the current schema with `migrate deploy`, which is
exactly what the backend container runs on boot. Aggregations use `groupBy` rather than
raw SQL, so the statistics queries carry no dialect assumptions.

#### Custom-made design system (Minor, 1)

ARCADE is styled as a CRT arcade cabinet. The reference at `/design` renders from real
component source, so it cannot drift from the product.

- **Palette.** 13 tokens in the `@theme` block of `globals.css`: six neon accents, five
  surface and text greys, plus background and foreground, each with a documented
  semantic use. Colour is never the only signal, so online and offline carry a dot and
  a word as well as a hue.
- **Typography.** Press Start 2P for display only, because a pixel face is unreadable
  in a paragraph, and Geist Mono for anything read in quantity, since monospace stops
  room codes and scores from shifting width as digits change.
- **Icons.** 21 icons drawn as pixel art on a 16x16 grid and rendered as crisp-edged
  SVG rectangles. An off-the-shelf vector set would anti-alias into a different design
  language than the pixel typeface beside it. They inherit `currentColor`, so they take
  the palette like text.
- **19 reusable components.** `Button`, `ButtonLink`, `Card`, `Badge`, `Input`,
  `Field`, `Icon`, `Avatar`, `FriendAvatar`, `GameCard`, `NavLink`, `GameStatusBar`,
  `GamePageHeader`, `GameOverModal`, `GameNotice`, `NoRoomScreen`, `LobbyRow`,
  `LegalDoc`, `Section`.

#### Support for additional browsers (Minor, 1)

Every feature was tested and fixed on **Firefox**, **Safari** and **Edge** in addition
to Chrome: authentication, both games end to end, chat, presence, lobbies, avatar
upload and the API key panel.

Browser-specific issues found and fixed:

- **Safari on iOS** zoomed the page whenever an input under 16px took focus. Shared
  controls were resized rather than the viewport being locked, so pinch-zoom still
  works.
- **Safari** restores pages from the back-forward cache with sockets already closed,
  which left games looking alive but frozen. Reconnection is now driven by the
  `pageshow` event rather than by mount alone.
- **Firefox** renders the pixel icons with anti-aliasing unless `shape-rendering` is
  set explicitly, which softened the whole design language.

UI and behaviour are consistent across all four. No known limitations remain.

## Individual Contributions

### ashalaab, Tech Lead

- Initialised the monorepo with root scripts running both services, then scaffolded the
  Next.js and NestJS applications and split the pages into route groups.
- Built the application shell and the frontend session layer end to end: token storage,
  the `apiFetch` wrapper, the auth context, live session state in the top bar, and the
  guard making every sidebar route require a session.
- Wrote the Minesweeper rules engine as a pure module and the gateway on top of it,
  including the three-second countdown and the shared opening cell.
- Owned the integration layer: scoped both game gateways to lobby rooms so a session
  belongs to a lobby row rather than a global singleton, kept lobby rows in sync with
  live rooms, and implemented disconnect-and-resume with seats keyed by user id.
- Built the whole public API module: `/api/v1`, key minting with hash-only storage, the
  per-key throttler, and the OpenAPI documentation.
- Built the design system: pixel icon set, shared primitives, game chrome, and the
  `/design` reference page.
- Set up the Docker Compose stack and the nginx TLS termination.

**Challenge.** Games began as standalone gateways with one global lobby each, which
made two concurrent matches impossible. Making the lobby row the identity of a game
session and keying seats by user id fixed it, and then made disconnect-and-resume fall
out almost for free.

### ssiddiqu, Product Owner

- Built the Super Tic-Tac-Toe client: frontend rules engine, WebSocket message types,
  the hook connecting the board to the server, and the board component.
- Replaced Minesweeper's single hardcoded board with a generator plus a deduction-only
  solver, so every board is clearable by reasoning from a shared opening cell, and
  added fog over the opponent's board.
- Ran a security and correctness pass over modules other people wrote: scoped the
  WebSocket connection cap per namespace, stopped trusting spoofed client IPs, added a
  per-socket message limiter, validated the chat REST body and history cursor, routed
  delivery by user id so every tab receives, fixed idle timers, hardened avatar
  uploads, made the file server crash-safe, reissued the JWT on a login change, and
  protected blocked rows from unfriend.
- Implemented user blocking, end to end.
- Wrote the Privacy Policy and Terms of Service pages against what the schema actually
  stores, and built the Settings API-key panel.
- Made the scope calls: capped lobbies at two players, removed the unimplemented ranked
  mode, dropped password reset, and deleted dead pages and stale nav links.

**Challenge.** "Solvable without guessing" is a property of a layout *plus* a starting
cell, which single-player Minesweeper hides by generating the board after the first
click. A race cannot do that, since both players need identical boards but would click
first in different places. The fix was to have the server pick the opening, reveal it
to both players before the countdown, and guarantee fairness from exactly that cell.

### aal-hawa, Project Manager

- Owned the database: the Prisma schema, every migration, and the migration from
  auto-increment integer user ids to UUIDs.
- Built authentication (register, login, JWT, account deletion), the lobby REST
  endpoints and the `xxx-xxx-xxx` room-code generator.
- Implemented the Super Tic-Tac-Toe server engine and its gateway with authentication
  and rate limits.
- Delivered the social layer in five sequenced phases: schema and profile module with
  avatar upload, friends module and presence service, chat module and gateway, the
  profile, friends and chat UI, then documentation.
- Wrote the shared handshake JWT verification and per-IP connection cap used by every
  gateway.
- Built the social gateway: realtime presence, friend requests, badges and live
  profile-update events.
- Integrated both game gateways with `game_results` writes and surfaced the statistics
  on profiles, in Settings and in the friends list.

**Challenge.** `FriendsService` needed the social gateway to push events while the
gateway needed `FriendsService` to resolve friend ids, which Nest refused at boot as a
circular dependency, twice. Rather than scatter `forwardRef` calls, presence was
extracted into its own service so the dependency runs one way.

### lalwafi, Developer

- Built the Minesweeper client: wire protocol types and helpers, the socket hook, the
  board refactored to be purely presentational, and the versus view.
- Paired on the lobbies branch, routing create, join and join-by-code into the game
  room, carrying the room code in the handshake, showing the opponent, and swapping the
  mock data layer for the real API.
- Added the opponent-disconnect indicator and the superseded-window notice.
- Made the game playable on a phone: tap to flag with an explicit reveal-and-flag
  toggle, since a touchscreen has no right click.
- Ran the whole responsive pass: mobile navigation drawer, thumb-sized controls,
  boards that shrink to the screen, single-pane chat when narrow, wrapped lobby forms,
  reflowed social and account screens, stepped-down display type, no iOS zoom on focus,
  and `prefers-reduced-motion` support.
- Ran cross-browser testing on Firefox, Safari and Edge, and fixed everything it found.

**Challenge.** The boards were built at a fixed pixel size, so they overflowed instead
of scaling. Making them shrink meant separating the board's presentational sizing from
its game state, which is why the board component became purely presentational first.

## Resources

### Documentation

- [Next.js](https://nextjs.org/docs) and the [App Router](https://nextjs.org/docs/app)
- [NestJS](https://docs.nestjs.com/), [WebSockets](https://docs.nestjs.com/websockets/gateways), [Rate limiting](https://docs.nestjs.com/security/rate-limiting)
- [Prisma](https://www.prisma.io/docs/) and [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate)
- [Socket.IO v4](https://socket.io/docs/v4/) and [Rooms](https://socket.io/docs/v4/rooms/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [class-validator](https://github.com/typestack/class-validator)
- [bcrypt for Node](https://github.com/kelektiv/node.bcrypt.js)
- [Helmet](https://helmetjs.github.io/)
- [Docker Compose](https://docs.docker.com/compose/) and [nginx TLS termination](https://nginx.org/en/docs/http/configuring_https_servers.html)

### Background reading

- [Simon Tatham's puzzle collection](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/), on generating puzzles that never require a guess
- [Ultimate Tic-Tac-Toe rules](https://en.wikipedia.org/wiki/Ultimate_tic-tac-toe)
- [OpenAPI 3 specification](https://spec.openapis.org/oas/v3.1.0)
- [RFC 7519, JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519)
- [OWASP HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html), WebSockets section

### AI usage

AI coding assistants were used for the following, and nothing else:

- **Scaffolding and boilerplate.** Initial NestJS module skeletons, DTO classes and
  repetitive controller wiring, including the first register and login implementation
  and the initial Prisma schema.
- **Feature planning.** The social layer was broken into five numbered phases, and the
  commit history follows that plan.
- **Security auditing.** An early audit of the backend, retained as
  `backend/SECURITY_AUDIT.md`. Its findings were verified and fixed by hand, and a
  later manual pass by a different team member found issues the audit had missed,
  including the unbounded socket message path and the spoofed client IP.
- **Container setup.** The Compose stack, both Dockerfiles and the nginx config were
  drafted with AI assistance, then verified by hand from a clean
  `docker compose up --build`.
- **Documentation.** Drafting this README and the explanatory comments in the more
  subtle modules, such as the Minesweeper solver.
- **Code review.** A second pass over type safety and authorisation checks, used as a
  checklist rather than an authority.

Two rules the team held to. Nothing was merged that its author could not explain line
by line, which is why several AI-suggested abstractions were rewritten by hand first.
And AI output was treated as a draft for another team member to review, not as a
result: the correctness passes in July and August exist because that review caught
real bugs.

---

*ARCADE. Play, chat, compete.*
