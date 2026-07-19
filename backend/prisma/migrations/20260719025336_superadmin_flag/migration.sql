-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "authProvider" TEXT NOT NULL DEFAULT 'local',
    "providerSubject" TEXT,
    "passwordHash" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("authProvider", "email", "id", "isDemo", "name", "passwordHash", "providerSubject", "role", "workspaceId") SELECT "authProvider", "email", "id", "isDemo", "name", "passwordHash", "providerSubject", "role", "workspaceId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- The demo admin becomes the platform super-admin while keeping its normal admin role in
-- the demo workspace (W-15). No-op on a fresh install (no such user).
UPDATE "User" SET "isSuperAdmin" = 1 WHERE "email" = 'demo-admin@demo.local';
