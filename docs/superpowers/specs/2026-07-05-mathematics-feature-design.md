# Mathematics Feature Design — NSW Selective Prep Coach

## Overview

Add Mathematics as a second subject area alongside Writing, covering the 20 Mathematical Reasoning topic categories from the Selective Test. Students can practice single-topic or all-topics timed tests, review scored results with explanations, track progress via a heatmap, and admin can generate AI-assisted 35-question worksheets with flexible topic selection.

## Data Model

### New Prisma Models

```prisma
model MathTopic {
  id                Int            @id @default(autoincrement())
  name              String
  slug              String         @unique
  description       String
  isDemo            Boolean        @default(false)
  questions         MathQuestion[]
  attempts          MathAttempt[]
  worksheets        MathWorksheet[]
}

model MathStimulusGroup {
  id        Int            @id @default(autoincrement())
  stimulus  String         // Shared text, table, or diagram description
  questions MathQuestion[]
}

model MathQuestion {
  id                Int                @id @default(autoincrement())
  topicId           Int
  stimulusGroupId   Int?               // Optional — linked to a stimulus group
  questionText      String
  options           String             // JSON array of 5 option strings
  correctIndex      Int                // 0-4 index into options array
  explanation       String
  percentCorrect    Float?             // Cohort % Correct for difficulty calibration
  isDemo            Boolean            @default(false)
  topic             MathTopic          @relation(fields: [topicId], references: [id])
  stimulusGroup     MathStimulusGroup? @relation(fields: [stimulusGroupId], references: [id])
}

model MathAttempt {
  id              Int            @id @default(autoincrement())
  topicId         Int?           // null for all-topics mixed test
  questions       String         // JSON array of question IDs in presentation order
  answers         String         // JSON array of selected answer indices (-1 = unanswered)
  topicBreakdown  String         // JSON: {"slug": {correct: N, total: N}, ...}
  score           Int            // Number correct
  totalQuestions  Int
  startedAt       DateTime
  finishedAt      DateTime
  timeTaken       Int            // seconds
  source          String         // "practice" or "worksheet"
  worksheetId     Int?
  isDemo          Boolean        @default(false)
  topic           MathTopic?     @relation(fields: [topicId], references: [id])
  worksheet       MathWorksheet? @relation(fields: [worksheetId], references: [id])
}

model MathWorksheet {
  id          Int          @id @default(autoincrement())
  title       String
  topicIds    String       // JSON array of selected topic slugs
  questions   String       // JSON array of generated question objects
  createdAt   DateTime     @default(now())
  isDemo      Boolean      @default(false)
  attempts    MathAttempt[]
}
```

### Key Design Decisions

- **`options` as JSON** — 5 strings in a JSON array, avoids a separate options table
- **`answers` as JSON** — array of selected indices, same order as `questions`
- **`topicBreakdown` as JSON** — per-topic correct/total counts, computed server-side on scoring. Enables the heatmap to aggregate from both single-topic and all-topics attempts
- **`MathAttempt.topicId` is optional** — null when it's an all-topics mixed test; `topicBreakdown` is the source of truth for heatmap aggregation
- **`MathWorksheet.questions` as JSON** — stores full generated question objects so the worksheet is self-contained even for AI-generated questions not in the seed bank
- **`percentCorrect` on MathQuestion** — from Types.pdf cohort data, used for AI difficulty calibration

## Twenty MathTopics (seeded)

1. Number Sentences
2. Probability
3. Combinations
4. Arithmetic
5. Patterns
6. Protractor Skills
7. Time
8. Magic Squares
9. Data Interpretation
10. Time Zones
11. Number Place Values
12. Multiples and Factors
13. Fractions
14. Lowest Common Multiple
15. Algebra
16. Perimeter
17. Directions
18. Weight
19. Speed, Distance, Time
20. Rotation

## Sidebar

- Mathematics as a second top-level accordion alongside Writing
- First item: "All Topics" (35-question full test)
- Then the 20 topics listed alphabetically
- Same expand/collapse pattern as Writing

## Student Practice Flow

### Single Topic
- Click topic → MathPracticeHome shows description, history summary, Start button
- Start → fetch questions for that topic only, timed at ~69s per question
- One question at a time, 5 options, Next/Submit flow
- Stimulus groups displayed once above their questions
- Auto-submit on timeout, or early submit (unanswered questions marked -1)

### All Topics
- Click "All Topics" → MathPracticeHome shows description, Start button
- Start → 35 questions mixed from all topics, 40-minute timer
- Same question-by-question flow as single topic

### After Submission
- POST `/api/math/attempts` → server scores, computes `topicBreakdown`
- Redirect to `/math/attempt/:id` review page
- Shows: X/Y score, percentage, time taken
- Each question: student answer, correct answer highlighted, ✓/✗ indicator, explanation

## Backend API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/math/topics` | List all MathTopics |
| GET | `/api/math/topics/:slug` | One topic with seeded questions |
| GET | `/api/math/questions` | Get questions for practice. `?topic=slug` or all-topics |
| POST | `/api/math/attempts` | Save completed attempt, compute score + breakdown |
| GET | `/api/math/attempts/:id` | Single attempt with full question details |
| GET | `/api/math/attempts` | List attempts, optional `?topic=slug` |
| GET | `/api/math/heatmap` | Aggregated scores per topic |
| POST | `/api/math/worksheets/generate` | AI-generate 35-question worksheet |
| POST | `/api/math/worksheets/save` | Save reviewed worksheet |
| GET | `/api/math/worksheets` | List worksheets |

## Frontend Pages

| Page | Route | Purpose |
|------|-------|---------|
| `MathPracticeHome` | `/math/:topicSlug` | Topic info, history, Start button |
| `MathTimedPractice` | `/math/:topicSlug/start` | Quiz screen with timer |
| `MathAttemptReview` | `/math/attempt/:id` | Scored results with explanations |

### New Components
- `MathQuestionCard` — renders question + 5 option buttons
- `MathStimulusDisplay` — shared stimulus text/table
- `MathAnswerReview` — per-question review (student answer, correct answer, ✓/✗, explanation)

## Admin Worksheet Generation

### Flow
1. Admin clicks "Mathematics" tab in Admin view
2. Sees Math heatmap with scores
3. "Generate Mathematics Worksheet" → topic selector modal
4. Checkboxes for topics (or "All Topics"), fixed at 35 questions
5. AI generates 35 questions with difficulty floor (hardest seeded question per topic)
6. Admin reviews questions in a grid, can re-generate individual ones
7. "Save Worksheet" → available to student

### AI Prompt
- Includes target topic's hardest seeded question (lowest % Correct) as exemplar
- Instructs: 5-option MC, one correct answer, four plausible distractors, detailed explanation
- For mixed: distribute questions proportionally across selected topics

## Demo Data

- Extends existing `/api/demo/load` and `/api/demo/clear`
- Seeds ~30 MathAttempts across all 20 topics with realistic scores
- Seeds 1 completed MathWorksheet with 35 questions
- All marked `isDemo: true`
- Same clear-Demo removes only demo records

## Source Data

### From T5-Maths.pdf
- 35 questions with answer options, correct answers, and explanations
- Questions 25-28 share a stimulus group (Hettie's bicycle line graph)
- All questions are 5-option multiple choice (A-E)

### From Types.pdf
- Per-question topic category assignment
- Per-question cohort % Correct for difficulty calibration

## 35 Seeded Questions — Topic Map

| Q | Topic | % Correct |
|---|-------|-----------|
| 1 | Number Sentences | 94.60% |
| 2 | Probability | 76.09% |
| 3 | Combinations | 82.01% |
| 4 | Arithmetic | 80.98% |
| 5 | Patterns | 69.92% |
| 6 | Protractor Skills | 66.32% |
| 7 | Arithmetic | 87.15% |
| 8 | Algebra | 69.41% |
| 9 | Time | 61.18% |
| 10 | Magic Squares | 85.60% |
| 11 | Data Interpretation | 82.52% |
| 12 | Time Zones | 75.06% |
| 13 | Patterns | 77.89% |
| 14 | Number Place Values | 83.03% |
| 15 | Multiples and Factors | 67.87% |
| 16 | Arithmetic | 45.76% |
| 17 | Fractions | 58.35% |
| 18 | Lowest Common Multiple | 74.55% |
| 19 | Algebra | 65.81% |
| 20 | Perimeter | 35.22% |
| 21 | Directions | 50.13% |
| 22 | Weight | 44.99% |
| 23 | Data Interpretation | 67.35% |
| 24 | Arithmetic | 47.04% |
| 25 | Speed, Distance, Time | 34.70% |
| 26 | Speed, Distance, Time | 49.87% |
| 27 | Speed, Distance, Time | 30.33% |
| 28 | Speed, Distance, Time | 36.25% |
| 29 | Perimeter | 42.67% |
| 30 | Rotation | 65.55% |
| 31 | Fractions | 44.22% |
| 32 | Speed, Distance, Time | 38.56% |
| 33 | Data Interpretation | 55.78% |
| 34 | Protractor Skills | 43.19% |
| 35 | Algebra | 38.56% |

## Stimulus Groups

- **Group 1** (Q25-28): "Questions 25 to 28 refers to the following information. The following line graph details the time and distance that Hettie travels by bicycle in a day." — 4 questions, all Speed, Distance, Time

## Follows Existing Patterns

- Same `isDemo` flag pattern for demo data management
- Same heatmap approach (Recharts, color-coded cells, red→green scale)
- Same sidebar pattern (expandable accordion, mobile responsive)
- Same brand palette (#1c6dd0, #2e9e5b, #f2a71b)
- Same timer component (circular SVG countdown)
- Same API route structure convention
- Same banned-element avoidance