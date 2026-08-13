-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_lobbies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "options" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "lobbies_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_lobbies" ("createdAt", "game", "hostId", "id", "maxPlayers", "name", "options", "status", "updatedAt") SELECT "createdAt", "game", "hostId", "id", "maxPlayers", "name", "options", "status", "updatedAt" FROM "lobbies";
DROP TABLE "lobbies";
ALTER TABLE "new_lobbies" RENAME TO "lobbies";
CREATE INDEX "lobbies_game_idx" ON "lobbies"("game");
CREATE INDEX "lobbies_hostId_idx" ON "lobbies"("hostId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
