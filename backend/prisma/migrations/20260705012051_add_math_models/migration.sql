-- CreateTable
CREATE TABLE "MathTopic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "MathStimulusGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stimulus" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "MathQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topicId" INTEGER NOT NULL,
    "stimulusGroupId" INTEGER,
    "questionText" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "percentCorrect" REAL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MathQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "MathTopic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MathQuestion_stimulusGroupId_fkey" FOREIGN KEY ("stimulusGroupId") REFERENCES "MathStimulusGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MathAttempt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    CONSTRAINT "MathAttempt_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "MathTopic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MathAttempt_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "MathWorksheet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MathWorksheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "topicIds" TEXT NOT NULL,
    "questions" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE UNIQUE INDEX "MathTopic_slug_key" ON "MathTopic"("slug");
