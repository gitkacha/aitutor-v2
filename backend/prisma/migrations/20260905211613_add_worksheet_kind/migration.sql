-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MathWorksheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "topicIds" TEXT NOT NULL,
    "questions" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "kind" TEXT NOT NULL DEFAULT 'standard',
    CONSTRAINT "MathWorksheet_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MathWorksheet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MathWorksheet" ("createdAt", "createdById", "id", "isDemo", "questions", "title", "topicIds", "workspaceId") SELECT "createdAt", "createdById", "id", "isDemo", "questions", "title", "topicIds", "workspaceId" FROM "MathWorksheet";
DROP TABLE "MathWorksheet";
ALTER TABLE "new_MathWorksheet" RENAME TO "MathWorksheet";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
