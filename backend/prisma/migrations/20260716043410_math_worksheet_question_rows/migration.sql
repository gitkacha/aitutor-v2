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
    CONSTRAINT "MathQuestion_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "MathWorksheet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MathQuestion" ("correctIndex", "explanation", "id", "isDemo", "options", "percentCorrect", "questionText", "stimulusGroupId", "topicId") SELECT "correctIndex", "explanation", "id", "isDemo", "options", "percentCorrect", "questionText", "stimulusGroupId", "topicId" FROM "MathQuestion";
DROP TABLE "MathQuestion";
ALTER TABLE "new_MathQuestion" RENAME TO "MathQuestion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
