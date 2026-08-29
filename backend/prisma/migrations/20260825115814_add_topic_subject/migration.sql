-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MathTopic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subject" TEXT NOT NULL DEFAULT 'math',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_MathTopic" ("description", "id", "isDemo", "name", "slug") SELECT "description", "id", "isDemo", "name", "slug" FROM "MathTopic";
DROP TABLE "MathTopic";
ALTER TABLE "new_MathTopic" RENAME TO "MathTopic";
CREATE UNIQUE INDEX "MathTopic_slug_key" ON "MathTopic"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
