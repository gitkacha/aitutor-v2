-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN "criteriaScores" TEXT;

-- AlterTable
ALTER TABLE "MathAttempt" ADD COLUMN "answerChanges" TEXT;
ALTER TABLE "MathAttempt" ADD COLUMN "questionFlags" TEXT;
ALTER TABLE "MathAttempt" ADD COLUMN "questionTimings" TEXT;

-- CreateTable
CREATE TABLE "Skill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subject" TEXT NOT NULL,
    "topicId" INTEGER,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "examLevelNotes" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Skill_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "MathTopic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MathQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topicId" INTEGER NOT NULL,
    "stimulusGroupId" INTEGER,
    "worksheetId" INTEGER,
    "skillId" INTEGER,
    "questionText" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "percentCorrect" REAL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MathQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "MathTopic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MathQuestion_stimulusGroupId_fkey" FOREIGN KEY ("stimulusGroupId") REFERENCES "MathStimulusGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MathQuestion_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "MathWorksheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MathQuestion_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MathQuestion" ("correctIndex", "explanation", "id", "isDemo", "options", "percentCorrect", "questionText", "stimulusGroupId", "topicId", "worksheetId") SELECT "correctIndex", "explanation", "id", "isDemo", "options", "percentCorrect", "questionText", "stimulusGroupId", "topicId", "worksheetId" FROM "MathQuestion";
DROP TABLE "MathQuestion";
ALTER TABLE "new_MathQuestion" RENAME TO "MathQuestion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Skill_slug_key" ON "Skill"("slug");
