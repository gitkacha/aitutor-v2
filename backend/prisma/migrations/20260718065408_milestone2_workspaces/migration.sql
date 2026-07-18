/*
  Warnings:

  - Added the required column `userId` to the `Attempt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `MathAttempt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `MathWorksheet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `MathWorksheet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `Worksheet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `Worksheet` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Workspace" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "authProvider" TEXT NOT NULL DEFAULT 'local',
    "providerSubject" TEXT,
    "passwordHash" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorksheetAssignment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "worksheetId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorksheetAssignment_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "Worksheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorksheetAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MathWorksheetAssignment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "worksheetId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MathWorksheetAssignment_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "MathWorksheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MathWorksheetAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ── Backfill (Milestone 2): pre-existing data moves into a Demo workspace ─────
-- Only databases that already contain data get the demo workspace and its users;
-- a fresh install stays clean and goes through the first-run setup screen instead.
-- Default passwords (documented in README): demo1234 for both demo users.
INSERT INTO "Workspace" ("name", "slug", "isDemo")
SELECT 'Demo Workspace', 'demo-workspace', 1
WHERE EXISTS (SELECT 1 FROM "Attempt") OR EXISTS (SELECT 1 FROM "MathAttempt")
   OR EXISTS (SELECT 1 FROM "Worksheet") OR EXISTS (SELECT 1 FROM "MathWorksheet");

INSERT INTO "User" ("workspaceId", "role", "name", "email", "authProvider", "passwordHash", "isDemo")
SELECT w."id", 'admin', 'Demo Admin', 'demo-admin@demo.local', 'local',
       '$2b$10$FlqSRtXVI7MsP8kpKyox2uP8cfPgT4Ihw3m9DQLDnHt08IWZjLNQW', 1
FROM "Workspace" w WHERE w."slug" = 'demo-workspace';

INSERT INTO "User" ("workspaceId", "role", "name", "email", "authProvider", "passwordHash", "isDemo")
SELECT w."id", 'student', 'Demo Student', 'demo-student@demo.local', 'local',
       '$2b$10$FlqSRtXVI7MsP8kpKyox2uP8cfPgT4Ihw3m9DQLDnHt08IWZjLNQW', 1
FROM "Workspace" w WHERE w."slug" = 'demo-workspace';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attempt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "promptId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME NOT NULL,
    "timeTaken" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "worksheetId" INTEGER,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attempt_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "WritingType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attempt_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attempt_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "Worksheet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Attempt" ("finishedAt", "id", "isDemo", "promptId", "source", "startedAt", "text", "timeTaken", "typeId", "worksheetId", "userId") SELECT "finishedAt", "id", "isDemo", "promptId", "source", "startedAt", "text", "timeTaken", "typeId", "worksheetId", (SELECT "id" FROM "User" WHERE "email" = 'demo-student@demo.local') FROM "Attempt";
DROP TABLE "Attempt";
ALTER TABLE "new_Attempt" RENAME TO "Attempt";
CREATE TABLE "new_MathAttempt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "topicId" INTEGER,
    "questions" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "topicBreakdown" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME NOT NULL,
    "timeTaken" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "worksheetId" INTEGER,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MathAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MathAttempt_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "MathTopic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MathAttempt_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "MathWorksheet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MathAttempt" ("answers", "finishedAt", "id", "isDemo", "questions", "score", "source", "startedAt", "timeTaken", "topicBreakdown", "topicId", "totalQuestions", "worksheetId", "userId") SELECT "answers", "finishedAt", "id", "isDemo", "questions", "score", "source", "startedAt", "timeTaken", "topicBreakdown", "topicId", "totalQuestions", "worksheetId", (SELECT "id" FROM "User" WHERE "email" = 'demo-student@demo.local') FROM "MathAttempt";
DROP TABLE "MathAttempt";
ALTER TABLE "new_MathAttempt" RENAME TO "MathAttempt";
CREATE TABLE "new_MathWorksheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "topicIds" TEXT NOT NULL,
    "questions" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MathWorksheet_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MathWorksheet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MathWorksheet" ("createdAt", "id", "isDemo", "questions", "title", "topicIds", "workspaceId", "createdById") SELECT "createdAt", "id", "isDemo", "questions", "title", "topicIds", (SELECT "id" FROM "Workspace" WHERE "slug" = 'demo-workspace'), (SELECT "id" FROM "User" WHERE "email" = 'demo-admin@demo.local') FROM "MathWorksheet";
DROP TABLE "MathWorksheet";
ALTER TABLE "new_MathWorksheet" RENAME TO "MathWorksheet";
CREATE TABLE "new_Worksheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "typeId" INTEGER NOT NULL,
    "prompts" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Worksheet_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Worksheet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Worksheet" ("createdAt", "id", "isDemo", "prompts", "title", "typeId", "workspaceId", "createdById") SELECT "createdAt", "id", "isDemo", "prompts", "title", "typeId", (SELECT "id" FROM "Workspace" WHERE "slug" = 'demo-workspace'), (SELECT "id" FROM "User" WHERE "email" = 'demo-admin@demo.local') FROM "Worksheet";
DROP TABLE "Worksheet";
ALTER TABLE "new_Worksheet" RENAME TO "Worksheet";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Every migrated worksheet is assigned to the demo student (no-op on fresh installs).
INSERT INTO "WorksheetAssignment" ("worksheetId", "studentId")
SELECT w."id", (SELECT "id" FROM "User" WHERE "email" = 'demo-student@demo.local')
FROM "Worksheet" w;
INSERT INTO "MathWorksheetAssignment" ("worksheetId", "studentId")
SELECT w."id", (SELECT "id" FROM "User" WHERE "email" = 'demo-student@demo.local')
FROM "MathWorksheet" w;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WorksheetAssignment_worksheetId_studentId_key" ON "WorksheetAssignment"("worksheetId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MathWorksheetAssignment_worksheetId_studentId_key" ON "MathWorksheetAssignment"("worksheetId", "studentId");
