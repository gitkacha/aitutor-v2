-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CoachingModule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approach" TEXT NOT NULL DEFAULT 'standard',
    "reviewedById" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachingModule_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CoachingModule" ("content", "createdAt", "id", "reviewedById", "skillId", "status", "title", "version", "workspaceId") SELECT "content", "createdAt", "id", "reviewedById", "skillId", "status", "title", "version", "workspaceId" FROM "CoachingModule";
DROP TABLE "CoachingModule";
ALTER TABLE "new_CoachingModule" RENAME TO "CoachingModule";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
