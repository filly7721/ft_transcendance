-- CreateTable
CREATE TABLE "lobbies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostId" INTEGER NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "options" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "lobbies_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lobby_members" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lobbyId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lobby_members_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "lobbies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lobby_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "lobbies_game_idx" ON "lobbies"("game");

-- CreateIndex
CREATE INDEX "lobbies_hostId_idx" ON "lobbies"("hostId");

-- CreateIndex
CREATE INDEX "lobby_members_lobbyId_idx" ON "lobby_members"("lobbyId");

-- CreateIndex
CREATE INDEX "lobby_members_userId_idx" ON "lobby_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "lobby_members_lobbyId_userId_key" ON "lobby_members"("lobbyId", "userId");
