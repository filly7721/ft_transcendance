# Implementation Plan — Profile, Friends, Chat

**Task:** `5f63f1e288df0bd0` — PLAN the architecture and features for user profile, friend management, and a chat system, respecting the 42 subject rules. STOP AND WAIT for confirmation before writing code.

**Branch context:** `feature/profile-friends-chat` (push `942c935c`, 119 files). The codebase is now a full merge: auth (Prisma + JWT + bcrypt + passport + class-validator) + security fixes (C1-C3, M1-M2) + games (minesweeper + superttt WS gateways) + lobbies + frontend auth integration (AuthProvider, api.ts, auth.ts).

---

## 1. 42 Subject Compliance Check

The subject (§IV.1 Web, §IV.3 User Management) requires these modules. This plan covers:

| Module | Type | Points | Status after this plan |
|---|---|---|---|
| Allow users to interact (chat + profile + friends) | Major | 2 | ✅ Delivered |
| Standard user management (profile update, avatar, friends, online status) | Major | 2 | ✅ Delivered (profile + friends parts) |
| Advanced chat features (block, game invites, typing, read receipts) | Minor | 1 | ⚠️ Deferred (basic chat only in this plan) |

**Subject rules respected:**
- ✅ Frontend + backend + database (all three touched)
- ✅ Form validation on BOTH frontend and backend (class-validator DTOs + zod/react-hook-form on frontend)
- ✅ Hashed+salted passwords (already done via bcrypt)
- ✅ HTTPS for browser→backend (Caddy gateway)
- ✅ .env for secrets + .env.example (already done)
- ✅ DB with clear schema + relations (Prisma)
- ✅ Git commit messages will be clear and descriptive
- ✅ Multi-user support (concurrent chat, real-time friends list)
- ✅ Real-time features via WebSockets (chat uses socket.io, friends online status uses socket.io)
- ⚠️ Avatar upload: subject §IV.3 says "Users can upload an avatar (with a default avatar if none provided)". This is part of Standard User Management. I'll include it but flag it as optional scope.
- ⚠️ Privacy Policy + Terms of Service pages (subject §III.2 mandatory) — NOT in this plan's scope but flagged as a follow-up

---

## 2. Current State Analysis

### Backend (already exists)
- **Auth:** `POST /auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `DELETE /auth/account` — JWT-based, bcrypt, class-validator DTOs, ThrottlerGuard
- **Users:** `GET /users/me` (JWT-guarded) — returns SafeUser (no passwordHash)
- **Prisma schema:** `User` (UUID id, email, login, displayName, passwordHash, timestamps), `PasswordResetToken`, `Lobby`, `LobbyMember`
- **Security:** C1 (JWT on WS), C2 (rate limit), C3 (idle timeouts), M1+M2 (WS hardening) — all applied
- **Common:** `@CurrentUser()` decorator, `AuthenticatedUser` type, `PrismaExceptionFilter`, `WsRateLimiter`, `verifyWsToken()`

### Frontend (already exists)
- **Auth:** `AuthProvider` (context, login/register/logout, token verify on mount), `apiFetch` wrapper (auto-attaches Bearer token), `auth-storage.ts` (localStorage)
- **Layout:** `TopBar` + `Sidebar` + `Footer`, `(with-sidebar)` route group redirects guests to `/login`
- **Pages:** `/login`, `/register`, `/` (home), `/faq`, `/game/minesweeper`, `/game/super-tic-tac-toe`, `/lobby/[game]`, `/test`
- **Games:** Minesweeper + SuperTtt components (SuperTtt is a real interactive component now, not just a demo)

### What's MISSING (this plan's scope)
1. **Profile page** — users can view/edit displayName, see their stats
2. **Avatar** — upload + default
3. **Friends** — add/accept/reject/remove, see online status, friends list
4. **Chat** — real-time DM between friends (text only, basic)

---

## 3. Proposed Architecture

### 3.1 Database schema changes (Prisma)

Add 3 new models to `prisma/schema.prisma`:

```prisma
/// A friendship request from one user to another.
model Friendship {
  id           Int      @id @default(autoincrement())
  requesterId  String   // UUID FK → User.id
  addresseeId  String   // UUID FK → User.id
  status       String   @default("PENDING") // PENDING | ACCEPTED | BLOCKED
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  requester User @relation("FriendshipRequester", fields: [requesterId], references: [id], onDelete: Cascade)
  addressee User @relation("FriendshipAddressee", fields: [addresseeId], references: [id], onDelete: Cascade)

  @@unique([requesterId, addresseeId])
  @@index([addresseeId, status])
  @@index([requesterId, status])
  @@map("friendships")
}

/// A direct message between two users.
model Message {
  id         Int      @id @default(autoincrement())
  senderId   String   // UUID FK → User.id
  receiverId String   // UUID FK → User.id
  content    String   // max 1000 chars (enforced in DTO)
  readAt     DateTime? // null = unread
  createdAt  DateTime @default(now())

  sender   User @relation("MessageSender", fields: [senderId], references: [id], onDelete: Cascade)
  receiver User @relation("MessageReceiver", fields: [receiverId], references: [id], onDelete: Cascade)

  @@index([receiverId, readAt])  // unread inbox lookup
  @@index([senderId, receiverId]) // conversation thread
  @@map("messages")
}
```

Add to `User` model:
```prisma
  /// Avatar URL (null = use default). Stored as a path or data URL.
  avatarUrl    String?

  /// Friendships this user initiated.
  friendshipsRequested Friendship[] @relation("FriendshipRequester")
  /// Friendships this user received.
  friendshipsReceived  Friendship[] @relation("FriendshipAddressee")
  /// Messages this user sent.
  messagesSent         Message[]    @relation("MessageSender")
  /// Messages this user received.
  messagesReceived     Message[]    @relation("MessageReceiver")
```

**Why this schema:**
- `Friendship` is a single row per relationship (not two) — `requesterId`/`addresseeId` is directional. `@@unique` prevents duplicate requests. `status` is a string (not enum) for SQLite/Postgres wire-compatibility (same pattern as Lobby.status).
- `Message` has `readAt` for unread badges. Indexes optimize the two common queries: "my unread inbox" and "my conversation with user X".
- `avatarUrl` is a nullable String — supports both file-path URLs and data URLs. No separate avatar table needed at this scale.

### 3.2 Backend modules (3 new + 1 edited)

#### `src/profile/profile.module.ts` + service + controller + dto
- `GET /users/me` already exists — extend it (or add `GET /users/:login` for public profiles)
- `PATCH /users/me` — update displayName (and avatarUrl if no file upload)
- `POST /users/me/avatar` — multipart upload (uses `@UseInterceptors(FileInterceptor)`)
- `GET /users/:login` — public profile (displayName, avatarUrl, stats; NO email)
- **DTOs:** `UpdateProfileDto { displayName?, avatarUrl? }` with class-validator
- **Avatar storage:** save to `backend/uploads/avatars/<userId>.<ext>`, serve via `express.static`. Default avatar = a static SVG.
- **Validation:** displayName 3-20 chars, avatar max 2MB, types: image/png, image/jpeg, image/webp

#### `src/friends/friends.module.ts` + service + controller + dto
- `POST /friends/request/:login` — send friend request (404 if user not found, 409 if already friends or pending)
- `POST /friends/accept/:id` — accept a pending request (404 if not found, 403 if not the addressee)
- `POST /friends/reject/:id` — reject a pending request (deletes the row)
- `DELETE /friends/:login` — unfriend (deletes accepted friendship, both directions)
- `GET /friends` — list accepted friends (login, displayName, avatarUrl, online status)
- `GET /friends/requests` — list pending requests (incoming + outgoing)
- **Security:** all JWT-guarded. Can only accept/reject requests addressed to you. Can only unfriend your own friends.
- **Online status:** derived from a WebSocket presence gateway (see §3.3) — the friends list query joins against an in-memory `Set<userId>` of connected users.

#### `src/chat/chat.module.ts` + gateway + service + dto
- **REST endpoints:**
  - `GET /chat/conversations` — list of friends you have conversations with + last message + unread count
  - `GET /chat/:login?cursor=<msgId>&limit=50` — paginated message history with a friend (newest first, cursor-based)
  - `POST /chat/:login` — send a message (REST fallback; real-time via WS preferred)
- **WebSocket gateway** (`@WebSocketGateway({ namespace: 'chat' })`):
  - Connection: JWT-verified (reuse `verifyWsToken`), registers `userId → socketId` in an in-memory `Map`
  - `chat:send { receiverLogin, content }` → server validates, persists, emits `chat:message` to receiver (if online) + acks sender
  - `chat:typing { receiverLogin }` → emits `chat:typing` to receiver
  - `chat:read { senderLogin }` → marks messages as read, emits `chat:read-receipt` to sender
  - `chat:history { peerLogin, cursor? }` → returns paginated history (ack)
- **Security:** can only message accepted friends (403 if not friends). Content validated (1-1000 chars, no HTML — escape on render). Rate-limited (30 msgs/min/user).
- **Presence:** on connect/disconnect, broadcast `presence:update { userId, online: boolean }` to the user's friends. The friends list reads from this.

#### `src/presence/presence.module.ts` + service (shared)
- `PresenceService` — in-memory `Map<userId, Set<socketId>>` (a user can have multiple tabs)
- `isOnline(userId): boolean`
- `getOnlineUserIds(): Set<string>`
- Used by: chat gateway (to deliver messages), friends service (to show online status), presence broadcasts
- **Note:** in-memory is fine for single-server. For multi-server (future), this would need Redis adapter. Out of scope for now.

#### Edited: `src/app.module.ts`
- Register `ProfileModule`, `FriendsModule`, `ChatModule`, `PresenceModule`

### 3.3 Frontend (4 new pages/sections + 3 lib files)

#### `src/lib/friends.ts`
- `fetchFriends()`, `fetchFriendRequests()`, `sendFriendRequest(login)`, `acceptFriendRequest(id)`, `rejectFriendRequest(id)`, `unfriend(login)`
- Types: `Friend { id, login, displayName, avatarUrl, online }`, `FriendRequest { id, from, to, status, createdAt }`

#### `src/lib/chat.ts`
- `fetchConversations()`, `fetchHistory(peerLogin, cursor?)`, `sendMessage(peerLogin, content)` (REST fallback)
- Types: `Conversation { peerLogin, peerDisplayName, peerAvatar, lastMessage, unreadCount }`, `Message { id, senderLogin, receiverLogin, content, readAt, createdAt }`

#### `src/lib/presence.ts` (or fold into chat)
- Socket.io client setup for the chat namespace + presence

#### `src/components/chat/ChatWidget.tsx`
- Floating chat panel (bottom-right) — conversation list + active thread
- Uses socket.io for real-time; falls back to REST polling if WS fails
- Shows typing indicator, unread badge, online dot

#### `src/app/(with-sidebar)/profile/[login]/page.tsx`
- Public profile page: avatar, displayName, login, stats (games played, wins — future), "Add Friend" / "Unfriend" / "Message" buttons
- Edit mode for own profile (PATCH /users/me)

#### `src/app/(with-sidebar)/friends/page.tsx`
- Friends list (with online status), pending requests (incoming/outgoing), search users to add

#### `src/app/(with-sidebar)/settings/page.tsx`
- Edit displayName, change avatar, change password (future), delete account (already exists at DELETE /auth/account)

### 3.4 File upload (avatar)
- Backend: `@nestjs/platform-express` + `FileInterceptor` (already a dep via platform-express)
- Storage: `diskStorage` to `backend/uploads/avatars/`, filename = `${userId}-${Date.now()}.${ext}`
- Serve: `app.useStaticAssets(path.join(__dirname, '..', 'uploads'))` in main.ts
- Limits: 2MB, image types only (validated server-side)
- `.gitignore`: add `backend/uploads/`

---

## 4. Implementation Order (phases)

### Phase 1 — Database + Profile (backend)
1. Add `avatarUrl` to User, add `Friendship` + `Message` models to schema
2. `npx prisma migrate dev --name add_profile_friends_chat`
3. Create `ProfileModule` (service + controller + DTOs)
4. Endpoints: `PATCH /users/me`, `POST /users/me/avatar`, `GET /users/:login`
5. Static file serving in main.ts

### Phase 2 — Friends (backend)
6. Create `FriendsModule` (service + controller + DTOs)
7. Endpoints: request, accept, reject, unfriend, list, list-requests
8. Create `PresenceService` (in-memory online tracking)

### Phase 3 — Chat (backend)
9. Create `ChatModule` (service + controller + gateway + DTOs)
10. REST: conversations, history, send
11. WS gateway: send, typing, read-receipt, presence broadcasts
12. Wire presence into friends list

### Phase 4 — Frontend
13. `src/lib/friends.ts` + `src/lib/chat.ts`
14. `src/app/(with-sidebar)/friends/page.tsx`
15. `src/app/(with-sidebar)/profile/[login]/page.tsx`
16. `src/components/chat/ChatWidget.tsx`
17. `src/app/(with-sidebar)/settings/page.tsx`

### Phase 5 — Polish
18. `.gitignore` updates (uploads/)
19. `.env.example` updates (if any new env vars)
20. README updates (features list — subject §VI requires this)

---

## 5. Security Considerations (respecting the audit)

- **C1 (auth):** all new endpoints JWT-guarded. Chat WS gateway reuses `verifyWsToken`.
- **C2 (rate limit):** chat messages rate-limited (30/min/user via ThrottlerGuard on REST + manual check in WS). Friend requests rate-limited (10/min/user).
- **C3 (idle timeout):** chat gateway has a 30-min idle timeout (longer than games — chat is less time-sensitive).
- **M1+M2:** chat gateway uses `maxHttpBufferSize: 1e4`, `transports: ['websocket']`.
- **Input validation:** all DTOs use class-validator. Message content max 1000 chars. displayName 3-20 chars. Avatar max 2MB + type check.
- **Authorization:** can only accept/reject requests addressed to you. Can only unfriend your own friends. Can only message accepted friends. Public profile does NOT expose email.
- **XSS:** message content stored as-is but rendered with React's default escaping (no `dangerouslySetInnerHTML`).
- **Enumeration:** user lookup by login is fine (login is public). No endpoint exposes emails. User IDs are UUIDs (non-enumerable).

---

## 6. Open Questions (need your input)

1. **Avatar upload scope:** Include it now, or defer? It adds file-upload middleware + static serving. The subject requires it for the "Standard user management" Major module, so I recommend including it.
2. **Chat scope:** Basic DM only (this plan), or also group chat / channels? The subject's "Advanced chat" Minor module adds block/typing/read-receipts — I've included typing + read-receipts. Block is deferred. Group chat is out of scope.
3. **Profile stats:** The subject's "Game statistics" Minor module requires a game. We have games. Include basic stats (games played, wins) now, or defer to a dedicated stats task?
4. **Frontend chat UI:** Floating widget (bottom-right) vs dedicated `/chat` page vs both? I proposed a widget; let me know if you prefer a page.
5. **Online status granularity:** Just online/offline, or also "away" (no activity for 5 min)? I proposed simple online/offline.
6. **Should I implement all 5 phases in one go, or phase-by-phase with your review between?** The task says "PLAN then STOP AND WAIT" — so I'll wait for your go-ahead on the whole plan before writing any code.

---

## 7. What I will NOT do (until you confirm)

- ❌ Write any code
- ❌ Modify any files
- ❌ Run any migrations
- ❌ Commit anything

I'm stopping here and waiting for your confirmation. Please reply with:
- ✅ "Go ahead with the full plan" → I implement all 5 phases
- ✅ "Go ahead with phases 1-3 only" (backend only) → I do backend, you do frontend
- ✏️ "Change X" → I revise the plan
- ❓ Answers to the open questions in §6
