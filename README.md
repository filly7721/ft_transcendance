*This project has been created as part of the 42 curriculum by <login1>[, <login2>[, <login3>[...]]].*

# ARCADE — ft_transcendence

## Description

**ARCADE** is a web-based multiplayer gaming platform where users can play classic arcade games (Minesweeper and Super Tic-Tac-Toe) in real-time against each other. The platform features user accounts with secure authentication, friend management, direct messaging, live game rooms with secret codes, and real-time WebSocket-based gameplay.

### Key Features

- **User Authentication** — secure signup/login with bcrypt-hashed passwords, JWT tokens, password reset flow
- **Profile Management** — customizable display name, avatar upload, public profile pages with game statistics
- **Friend System** — send/accept/reject friend requests, see online status, unfriend
- **Real-time Chat** — direct messages between friends with typing indicators, read receipts, and presence updates
- **Game Lobbies** — create/join lobby rooms with 9-digit secret codes (`xxx-xxx-xxx`)
- **Minesweeper Versus** — two players race on identical minefields via WebSocket
- **Super Tic-Tac-Toe** — 9 mini-boards in a 3×3 outer grid with the constrained-board rule
- **Security Hardening** — JWT auth on all WebSocket connections, per-IP rate limiting, idle timeouts, transport hardening

## Instructions

### Prerequisites

- **Node.js** >= 20
- **npm** or **bun**
- **Google Chrome** (latest stable — required by the 42 subject)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd ft_transcendence

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Environment Setup

**Backend** (`backend/.env` — copy from `.env.example`):
```bash
cd backend
cp .env.example .env
# Edit .env and set JWT_SECRET to a random hex string:
# openssl rand -hex 32
```

**Frontend** (`frontend/.env.local`):
```bash
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
```

### Database Setup

```bash
cd backend
npx prisma migrate dev --name init
# This creates the SQLite database (prisma/dev.db) and generates the Prisma client
```

### Running

```bash
# Terminal 1: Backend (port 3001)
cd backend
npm run start:dev

# Terminal 2: Frontend (port 3000)
cd frontend
npm run dev
```

Open `http://localhost:3000` in Chrome.

### Using the public API

Interactive docs (Swagger UI): **`http://localhost:3001/api/docs`**

```bash
# 1. Sign in to get a session token.
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"YourPassw0rd"}' | jq -r .accessToken)

# 2. Mint an API key. The raw key is shown ONCE — only its hash is stored.
KEY=$(curl -s -X POST http://localhost:3001/api/keys \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"my bot"}' | jq -r .key)

# 3. Call the public API with it. 100 requests/min, counted per key.
curl -s http://localhost:3001/api/v1/me -H "X-API-Key: $KEY"

curl -s -X POST http://localhost:3001/api/v1/lobbies -H "X-API-Key: $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"game":"super-tic-tac-toe","name":"bot lobby","maxPlayers":2}'

curl -s "http://localhost:3001/api/v1/lobbies?game=super-tic-tac-toe" -H "X-API-Key: $KEY"
curl -s -X PUT http://localhost:3001/api/v1/lobbies/<code> -H "X-API-Key: $KEY" \
  -H 'Content-Type: application/json' -d '{"name":"renamed"}'
curl -s -X DELETE http://localhost:3001/api/v1/lobbies/<code> -H "X-API-Key: $KEY"

# Revoke it when you're done — it stops working immediately.
curl -s -X DELETE http://localhost:3001/api/keys/<key-id> -H "Authorization: Bearer $TOKEN"
```

### Design system

The living style reference — palette, typography, the full icon set and every
shared component, all rendered from the real source — is at
**`http://localhost:3000/design`** once you are logged in.

### Docker (planned)

> **Note:** Docker containerization with single-command deployment is required by the 42 subject. A `docker-compose.yml` will be added before final submission.

## Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [class-validator](https://github.com/typestack/class-validator)
- [bcrypt](https://github.com/kelektiv/node.bcrypt.js)

### AI Usage

AI tools (Z.ai Code) were used for:
- **Code generation**: backend modules (profile, friends, chat, game engines), frontend components (ChatPanel, ChatWidget, friends/profile/settings pages)
- **Security audit**: identifying and fixing network vulnerabilities (C1-C3, M1-M2)
- **Architecture planning**: designing the profile/friends/chat feature plan
- **Code review**: verifying type safety, authorization checks, and 42 subject compliance

All AI-generated code was reviewed, tested, and understood by the team before inclusion.

## Team Information

> **Fill in with your team members and their roles.**

| Member | Login | Role(s) | Responsibilities |
|--------|-------|---------|-----------------|
| `<name>` | `<login>` | Product Owner | Product vision, feature prioritization |
| `<name>` | `<login>` | Project Manager | Team coordination, progress tracking |
| `<name>` | `<login>` | Tech Lead | Architecture, code quality, tech decisions |
| `<name>` | `<login>` | Developer | Backend implementation |
| `<name>` | `<login>` | Developer | Frontend implementation |

## Project Management

> **Fill in with your team's project management practices.**

- **Task tracking**: GitHub Issues / Trello
- **Communication**: Discord / Slack
- **Meeting frequency**: Weekly sync
- **Code review**: Pull requests reviewed by at least one other team member

## Technical Stack

### Frontend
- **Framework**: Next.js 16 (App Router) with React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 with custom arcade theme (neon colors, pixel font)
- **Real-time**: Socket.IO Client 4.8
- **State**: React Context (AuthProvider) + local state

### Backend
- **Framework**: NestJS 11 (Express)
- **Language**: TypeScript 5
- **Database**: SQLite (local dev) / PostgreSQL (production) via Prisma 5.22
- **Auth**: JWT (@nestjs/jwt) + Passport (passport-jwt) + bcrypt
- **Real-time**: Socket.IO 4.8 (@nestjs/websockets + @nestjs/platform-socket.io)
- **Validation**: class-validator + class-transformer
- **API docs**: @nestjs/swagger (OpenAPI 3, served at `/api/docs`)
- **Security**: @nestjs/throttler (rate limiting, per-IP and per-API-key), helmet (HTTP headers), WsRateLimiter (WS connection cap)

### Database Choice
SQLite for local development (zero-setup, file-based). PostgreSQL for production (robust, scalable). Both are wire-compatible with the Prisma schema (no enums, no native arrays — uses plain strings for status fields).

## Database Schema

```
┌──────────────────┐     ┌─────────────────────┐
│      User        │     │ PasswordResetToken  │
├──────────────────┤     ├─────────────────────┤
│ id (UUID, PK)    │◄──┐ │ id (Int, PK)        │
│ email (unique)   │   │ │ userId (FK → User)  │
│ login (unique)   │   │ │ tokenHash (unique)  │
│ displayName      │   │ │ expiresAt           │
│ passwordHash     │   │ │ usedAt              │
│ avatarUrl        │   └─┤ createdAt           │
│ createdAt        │     └─────────────────────┘
│ updatedAt        │
└──────┬───┬───┬───┘
       │   │   │
       │1  │1  │1
       │   │   │
       ▼   ▼   ▼
┌─────────┐ ┌──────────┐ ┌────────────┐
│ Lobby   │ │Friendship│ │ Message    │
├─────────┤ ├──────────┤ ├────────────┤
│id(room  │ │id(Int PK)│ │id(Int PK)  │
│ code)   │ │requester │ │senderId FK│
│ game    │ │addressee │ │receiverId │
│ name    │ │status    │ │content    │
│ hostId  │ │createdAt │ │readAt     │
│maxPlayer│ │updatedAt │ │createdAt  │
│ options │ └──────────┘ └────────────┘
│ status  │
│timestamps│  ┌────────────┐
└─────────┘  │ GameResult │
   │         ├────────────┤
   │1        │id(Int PK)  │
   │         │userId FK   │
   ▼         │game        │
┌────────────┐│result      │
│LobbyMember ││score       │
├────────────┤│playedAt    │
│id(Int PK)  │└────────────┘
│lobbyId FK  │
│userId FK   │
│joinedAt    │
│@@unique    │
└────────────┘
```

Additionally:

```
┌──────────────────────┐
│ ApiKey               │  Public-API credentials, one owner each.
├──────────────────────┤  Only the SHA-256 hash of the key is stored;
│ id (UUID, PK)        │  `prefix` is a display-only fragment so the
│ userId (FK → User)   │  owner can tell keys apart. Revoked keys are
│ name                 │  kept (revokedAt set) as an audit trail.
│ keyHash (unique)     │
│ prefix               │
│ lastUsedAt           │
│ revokedAt            │
│ createdAt            │
└──────────────────────┘
```

**Models**: User, PasswordResetToken, Lobby, LobbyMember, Friendship, Message, GameResult, ApiKey

## Features List

| Feature | Description | Implemented By |
|---------|-------------|----------------|
| User Registration | Email + login + password with bcrypt hashing | `<member>` |
| User Login | JWT-based authentication | `<member>` |
| Password Reset | SHA-256 hashed tokens, 15-min expiry | `<member>` |
| Profile Viewing | Public profile with stats (no email leak) | `<member>` |
| Profile Editing | Update display name | `<member>` |
| Avatar Upload | PNG/JPEG/WebP, 2MB max, multer diskStorage | `<member>` |
| Friend Requests | Send/accept/reject/unfriend | `<member>` |
| Online Status | Real-time presence via WebSocket | `<member>` |
| Direct Messaging | Real-time chat with friends via Socket.IO | `<member>` |
| Typing Indicators | Real-time typing notifications | `<member>` |
| Read Receipts | Message read-at tracking + notifications | `<member>` |
| Game Lobbies | Create/join with 9-digit secret codes | `<member>` |
| Minesweeper VS | Two-player race via WebSocket | `<member>` |
| Super Tic-Tac-Toe | 9 mini-boards, constrained-board rule | `<member>` |
| Disconnect & Resume | Seats held by user id; games resume across refreshes, opponent sees a DISCONNECTED indicator | `<member>` |
| Public API | `/api/v1` with API keys, per-key rate limiting, OpenAPI docs | `<member>` |
| Design System | Pixel icon set, shared primitives, `/design` reference page | `<member>` |
| Security Hardening | JWT on WS, rate limiting, idle timeouts | `<member>` |

## Modules

### Mandatory Part

| Requirement | Status |
|-------------|--------|
| Web application (frontend + backend + database) | ✅ |
| Git with clear commit messages, work split across the team | ✅ |
| Docker/Podman single-command deployment | ❌ **not started** |
| Google Chrome compatible, no console errors | ✅ |
| Privacy Policy + Terms of Service pages | ❌ **not written** |
| Multi-user support (concurrent, real-time) | ✅ |
| CSS framework (Tailwind CSS 4) | ✅ |
| `.env` + `.env.example`, secrets git-ignored | ✅ |
| Database with clear schema and relations (Prisma) | ✅ |
| User signup/login (bcrypt-hashed + salted, JWT) | ✅ |
| Form validation, frontend **and** backend | ✅ |
| HTTPS for every browser→backend connection | ❌ **plain HTTP today** |

> The three ❌ items are **rejection criteria**, not point deductions: the
> subject rejects the project outright if they are missing, no matter how many
> module points are earned. They are the top of the backlog.

### Chosen Modules — 16 points

| Module | Type | Pts | Where |
|--------|------|-----|-------|
| Framework for **both** frontend and backend (Next.js 16 + NestJS 11) | Major | 2 | `frontend/`, `backend/` |
| Real-time features over WebSockets (Socket.IO) | Major | 2 | `*/`*`.gateway.ts` |
| Users interact: chat + profiles + friends | Major | 2 | `chat/`, `profile/`, `friends/` |
| Standard user management (profile, avatar, friends, online status) | Major | 2 | `profile/`, `social/` |
| A complete web-based game (Super Tic-Tac-Toe) | Major | 2 | `superttt/` |
| Remote players on separate machines | Major | 2 | `superttt/`, `minesweeper/` |
| **Public API** with API key, rate limiting, docs, 5+ endpoints | Major | 2 | `public-api/`, `api-keys/` |
| ORM for the database (Prisma) | Minor | 1 | `prisma/` |
| **Custom design system** (10+ components, palette, type, icons) | Minor | 1 | `components/ui/`, `/design` |
| **Total** | | **16** | |

#### Public API (Major, 2pts)

A versioned, API-key-authenticated surface at **`/api/v1`**, deliberately
separate from the routes the frontend uses so integrations cannot be broken by
internal changes. Documented with OpenAPI at **`/api/docs`**.

- **Secured API key.** `POST /api/keys` (JWT-guarded) mints a key; the raw key
  is returned exactly once and only its SHA-256 hash is stored, so a database
  leak yields nothing replayable. Keys are revocable and act on behalf of their
  owner — a leaked key cannot escalate past one account.
- **Rate limiting.** 100 req/min bucketed **per key** (`ApiKeyThrottlerGuard`),
  not per IP: callers behind one NAT would otherwise exhaust each other's
  budget, and a single caller could dodge an IP limit by rotating addresses.
- **Documentation.** Swagger UI at `/api/docs`, with both auth schemes wired to
  the "Authorize" button so the whole flow is exercisable in the browser.
- **Endpoints (7, covering all four verbs).** `GET /v1/me`,
  `GET|POST /v1/lobbies`, `GET|PUT|DELETE /v1/lobbies/:code`,
  `GET /v1/players/:login`. Edits to a lobby you do not host return 404 rather
  than 403, so the API never confirms that a room code belongs to someone else.

#### Custom design system (Minor, 1pt)

ARCADE is styled as a CRT arcade cabinet. The living reference renders from the
real source at **`/design`** — palette, type scale, icons and components — so it
cannot drift away from the product.

- **Palette.** 11 tokens in `globals.css` `@theme`: six neon accents and five
  surface/text greys, each with a documented semantic use. Colour is never the
  sole signal — online/offline also carries a dot and a word.
- **Typography.** Press Start 2P for display (headings/buttons only — a pixel
  face is unreadable in paragraphs), Geist Mono for everything you read;
  monospace stops room codes and scores from shifting as digits change.
- **Icons.** 20 icons hand-drawn as pixel art on a 16×16 grid and rendered as
  crisp-edged SVG rects (`components/ui/Icon.tsx`). An off-the-shelf vector set
  would anti-alias into a different design language than the pixel typeface
  beside it. They inherit `currentColor`, so they take the palette like text.
- **Reusable components (12+).** `Button`/`ButtonLink`, `Card`, `Badge`,
  `Input`, `Field`, `Icon`, `Avatar`, `FriendAvatar`, `GameCard`, `NavLink`,
  `GameStatusBar`, `GamePageHeader`, `NoRoomScreen`, `LobbyRow`.

### Considered but NOT claimed

Honest accounting — these are implemented in part, and are **not** counted above:

| Module | Why it does not count yet |
|--------|---------------------------|
| Add another game w/ history + matchmaking | Minesweeper is playable, but no `GameResult` row is ever written and there is no matchmaking. 2 of 4 bullets fail. |
| Game statistics / match history | Same cause: the stats endpoint reads a table nothing writes to. |
| Advanced chat | Has typing indicators, read receipts, history — but no user blocking and no game invites from chat. |
| Notification system | Real-time badges for friend requests and unread messages only, not notifications for all create/update/delete actions. |
| SSR | Next.js server-renders by default, but the `(with-sidebar)` layout gates on client-side auth and returns `null`, so protected pages ship empty HTML. Claiming it would be dishonest until auth moves to a cookie session. |
| Multiple browser support | Very likely works in Firefox/Edge, but the module requires testing, fixing and documenting each — none of which has been done. |

## Individual Contributions

> **Fill in with each team member's contributions.**

### `<login>` — Role
- Implemented ...
- Challenges faced: ...
- Solutions: ...

---

*Built with the 42 curriculum. ARCADE — play, chat, compete.*
