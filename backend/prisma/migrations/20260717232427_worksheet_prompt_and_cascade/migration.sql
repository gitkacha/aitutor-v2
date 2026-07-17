-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MathQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topicId" INTEGER NOT NULL,
    "stimulusGroupId" INTEGER,
    "worksheetId" INTEGER,
    "questionText" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "percentCorrect" REAL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MathQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "MathTopic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MathQuestion_stimulusGroupId_fkey" FOREIGN KEY ("stimulusGroupId") REFERENCES "MathStimulusGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MathQuestion_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "MathWorksheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MathQuestion" ("correctIndex", "explanation", "id", "isDemo", "options", "percentCorrect", "questionText", "stimulusGroupId", "topicId", "worksheetId") SELECT "correctIndex", "explanation", "id", "isDemo", "options", "percentCorrect", "questionText", "stimulusGroupId", "topicId", "worksheetId" FROM "MathQuestion";
DROP TABLE "MathQuestion";
ALTER TABLE "new_MathQuestion" RENAME TO "MathQuestion";
CREATE TABLE "new_Prompt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "typeId" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'bank',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Prompt_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "WritingType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Prompt" ("id", "isDemo", "text", "typeId") SELECT "id", "isDemo", "text", "typeId" FROM "Prompt";
DROP TABLE "Prompt";
ALTER TABLE "new_Prompt" RENAME TO "Prompt";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
