/*
  Warnings:

  - You are about to drop the `password_reset_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "password_reset_tokens";
PRAGMA foreign_keys=on;
