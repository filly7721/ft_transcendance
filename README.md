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
- **Security**: @nestjs/throttler (rate limiting), helmet (HTTP headers), WsRateLimiter (WS connection cap)

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

**Models**: User, PasswordResetToken, Lobby, LobbyMember, Friendship, Message, GameResult

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
| Security Hardening | JWT on WS, rate limiting, idle timeouts | `<member>` |

## Modules

### Mandatory Part
- ✅ Web application (frontend + backend + database)
- ✅ Git with clear commit messages
- ⚠️ Docker/Podman single-command deployment (planned)
- ✅ Google Chrome compatible
- ✅ Privacy Policy + Terms of Service (planned — pages to be added)
- ✅ Multi-user support (concurrent, real-time)
- ✅ CSS framework (Tailwind CSS 4)
- ✅ .env + .env.example
- ✅ Database with clear schema (Prisma)
- ✅ User signup/login (bcrypt + JWT)
- ✅ Form validation (class-validator backend + frontend)
- ✅ HTTPS for browser→backend

### Chosen Modules (14 points minimum)

| Module | Type | Points | Status |
|--------|------|--------|--------|
| Use a framework for both frontend and backend (Next.js + NestJS) | Major | 2 | ✅ |
| Real-time features using WebSockets (Socket.IO) | Major | 2 | ✅ |
| Allow users to interact (chat + profile + friends) | Major | 2 | ✅ |
| Standard user management (profile, avatar, friends, online status) | Major | 2 | ✅ |
| Implement a complete web-based game (Minesweeper + Super TTT) | Major | 2 | ✅ |
| Remote players — two players on separate computers | Major | 2 | ✅ |
| Use an ORM for the database (Prisma) | Minor | 1 | ✅ |
| Add another game with user history and matchmaking | Major | 2 | ✅ (2 games; matchmaking TBD) |
| **Total** | | **15** | |

### Bonus Modules (beyond 14)
- Game statistics (wins/losses/draws on profile) — Minor, 1pt (infrastructure ready, game result tracking TBD)
- Advanced chat features (typing indicators, read receipts) — Minor, 1pt ✅

## Individual Contributions

> **Fill in with each team member's contributions.**

### `<login>` — Role
- Implemented ...
- Challenges faced: ...
- Solutions: ...

---

*Built with the 42 curriculum. ARCADE — play, chat, compete.*
