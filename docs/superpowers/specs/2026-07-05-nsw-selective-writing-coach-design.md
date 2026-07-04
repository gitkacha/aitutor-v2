# NSW Selective Writing Coach — Design Document

**Date:** 2026-07-05
**Status:** Approved

## 1. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Frontend** | Vite + React 18 + TypeScript | Spec requirement |
| **Styling** | Tailwind CSS + shadcn/ui | Matches brand palette, avoids AI-generic look, highly customisable |
| **Backend** | Express + TypeScript | Simple REST API, required for server-side SQLite + API key safety |
| **ORM** | Prisma + SQLite | Type-safe, auto-generated types, migrations, popular |
| **Charts** | Recharts | Heatmap + line charts, simple API, React-native |
| **Timer** | `react-countdown-circle-timer` | Popular, clean visual countdown |
| **AI** | OpenRouter API via backend proxy | Keeps API key server-side, model: `openrouter/free` |
| **Testing** | Vitest (unit) | Vite-native, minimal config |
| **Routing** | React Router v6 | Standard for React SPAs |
| **Dev runner** | `concurrently` | Single `npm run dev` starts both frontend and backend |

## 2. Project Structure

```
coach/
├── package.json               # Root workspace with concurrently dev script
├── .env                        # OPENROUTER_API_KEY
├── CLAUDE.md                   # Requirements (existing)
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma       # Data model
│   │   └── seed.ts             # 11 types + sample prompts
│   └── src/
│       ├── index.ts            # Express server entry
│       ├── routes/
│       │   ├── types.ts
│       │   ├── attempts.ts
│       │   ├── analysis.ts
│       │   ├── heatmap.ts
│       │   ├── worksheets.ts
│       │   └── demo.ts
│       ├── services/
│       │   ├── ai.service.ts   # OpenRouter calls
│       │   └── demo.service.ts # Demo data seed/clear
│       └── middleware/
│           └── error.ts        # Global error handler
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── App.tsx              # Layout: sidebar + router outlet
│       ├── main.tsx
│       ├── index.css            # Tailwind directives + brand tokens
│       ├── lib/
│       │   ├── api.ts          # Backend API client
│       │   └── utils.ts        # shadcn cn() helper
│       ├── components/
│       │   ├── ui/             # shadcn/ui primitives
│       │   ├── Sidebar.tsx
│       │   ├── Timer.tsx
│       │   ├── Heatmap.tsx
│       │   ├── ScoreHistory.tsx
│       │   └── AnalysisDisplay.tsx
│       ├── pages/
│       │   ├── PracticeHome.tsx
│       │   ├── TimedPractice.tsx
│       │   ├── Dashboard.tsx
│       │   ├── AttemptDetail.tsx
│       │   └── Admin.tsx
│       └── hooks/
│           ├── useTimer.ts
│           ├── useAttempts.ts
│           └── useHeatmap.ts
└── test/
    └── ... test helpers
```

## 3. Data Model (Prisma)

```prisma
model WritingType {
  id                Int       @id @default(autoincrement())
  name              String
  slug              String    @unique
  description       String
  expectedStructure String
  prompts           Prompt[]
  attempts          Attempt[]
}

model Prompt {
  id        Int       @id @default(autoincrement())
  text      String
  typeId    Int
  type      WritingType @relation(fields: [typeId], references: [id])
  attempts  Attempt[]
}

model Attempt {
  id          Int       @id @default(autoincrement())
  typeId      Int
  promptId    Int
  text        String
  startedAt   DateTime
  finishedAt  DateTime
  timeTaken   Int       // seconds
  source      String    // "practice" | "worksheet"
  worksheetId Int?
  type        WritingType @relation(fields: [typeId], references: [id])
  prompt      Prompt      @relation(fields: [promptId], references: [id])
  worksheet   Worksheet?  @relation(fields: [worksheetId], references: [id])
  analysis    Analysis?
}

model Analysis {
  id                Int     @id @default(autoincrement())
  attemptId         Int     @unique
  attempt           Attempt @relation(fields: [attemptId], references: [id])
  vocabScore        Int
  vocabComments     String
  structureScore    Int
  structureComments String
  contentScore      Int
  contentComments   String
  overallScore      Int
  summary           String
}

model Worksheet {
  id        Int       @id @default(autoincrement())
  title     String
  typeId    Int
  prompts   String    // JSON-encoded array of generated prompts
  createdAt DateTime  @default(now())
  attempts  Attempt[]
}
```

### Seed data

- 11 WritingTypes: Advertisement, Advice Sheet, Diary Entry, Discussion, Guide, Letter, Narrative/Creative, News Report, Persuasive, Review, Speech
- 5 sample Prompts per type (55 total)

## 4. API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/types` | List all writing types |
| GET | `/api/types/:slug` | One type with its prompts |
| POST | `/api/attempts` | Save a completed attempt |
| GET | `/api/attempts/:id` | Get attempt + analysis |
| GET | `/api/attempts` | List attempts, optional `?type=slug` filter |
| POST | `/api/analysis/:attemptId` | Trigger AI analysis |
| GET | `/api/heatmap` | Aggregated scores per type |
| POST | `/api/worksheets/generate` | AI-generate worksheet for weak types |
| GET | `/api/worksheets` | List worksheets |
| POST | `/api/demo/load` | Seed demo data |
| POST | `/api/demo/clear` | Remove demo data |

## 5. Frontend Routing

| Path | Page | Description |
|---|---|---|
| `/` | Redirect | → `/dashboard` |
| `/dashboard` | Dashboard | Heatmap + empty state |
| `/practice/:typeSlug` | PracticeHome | Type description, history, Start button |
| `/practice/:typeSlug/start` | TimedPractice | Writing screen with 30-min timer |
| `/attempt/:id` | AttemptDetail | Scores + AI feedback |
| `/admin` | Admin | Heatmap + worksheet controls + demo controls |

## 6. AI Service Design

Two OpenRouter calls, isolated in `backend/src/services/ai.service.ts`:

### analyzeAttempt(text, writingType)
- Prompt includes: the student's text, the writing type's name, the expected structure
- Requests JSON response with scores (0-100) and specific comments referencing the student's text
- On failure: returns a fallback analysis with `overallScore: 0` and an error note in summary

### generateWorksheetPrompt(weakTypes)
- Prompt: "Generate 3 practice prompts for a student weak in [weak types]. The prompts should target the expected structure of each type."
- Returns parsed prompts as strings
- On failure: returns a generic fallback prompt

Both use `openrouter/free` model via POST to `https://openrouter.ai/api/v1/chat/completions`.

## 7. Demo Data

`POST /api/demo/load` creates:
- 15-20 completed Attempts across most/all 11 text types, dated over past 4 weeks
- Realistic score spread (some strong, some weak, some mid)
- Full Analysis for each seeded Attempt
- 1 completed Worksheet with its own Attempts

`POST /api/demo/clear` removes records where a `isDemo` flag is true — every demo record gets `isDemo = true` in its metadata. This ensures real student attempts are never touched.

### Implementation note on `isDemo`

All five models get an optional `isDemo` boolean field (`@default(false)`). The `Clear Demo Data` backend endpoint deletes all records where `isDemo = true`. The frontend never exposes this field — it's purely an internal tracking flag.

## 8. Look and Feel

- **Brand palette**: `#1c6dd0` (blue), `#2e9e5b` (green), `#f2a71b` (amber) + grays
- **Heatmap**: exempt from brand palette, uses red→yellow→green performance scale
- **Banned**: background gradients, purple backgrounds, gradient buttons, single-side accent border lines
- **Typography**: system font stack via Tailwind (Inter if available, otherwise system sans-serif)
- **Timed Practice**: calm, distraction-free — large timer, plain textarea, word count, muted colors

## 9. Build Phases

### Phase 1 — Running skeleton and data
- Scaffold monorepo: root `package.json`, backend + frontend packages
- Prisma schema + migrations + seed (11 types, 55 prompts)
- Express server with `/api/types` route
- Vite + React + Tailwind + React Router scaffold
- Sidebar component showing Writing → text types
- Empty-state Dashboard
- Unit tests: CRUD for all 5 models

### Phase 2 — Timed practice test
- PracticeHome page (type description, history, Start button)
- TimedPractice page (prompt, 30-min timer, textarea, word count, submit)
- `POST /api/attempts` + `GET /api/attempts`
- Unit tests: start, auto-save on timeout, manual submit

### Phase 3 — Progress tracking and heatmap
- `GET /api/heatmap` endpoint (aggregate scores per type)
- Heatmap component (Recharts)
- ScoreHistory component (line chart per type)
- Drill-down: click cell → score history
- Unit tests: heatmap reflects scores

### Phase 4 — In-depth AI analysis
- `ai.service.ts` — OpenRouter integration
- `POST /api/analysis/:attemptId` — trigger and store analysis
- AttemptDetail page with analysis display
- Loading state while AI processes
- Unit tests (mocked AI)

### Phase 5 — Admin, worksheets, demo data
- Admin page (heatmap + controls, admin toggle)
- `POST /api/worksheets/generate` + `GET /api/worksheets`
- Worksheet completion flow
- `POST /api/demo/load` + `POST /api/demo/clear`
- Unit tests: worksheet lifecycle, demo data

### Phase 6 — Look and feel, e2e validation
- Brand palette applied consistently
- Remove banned elements (gradients, purple, etc.)
- Full browser walkthrough of every screen
- No browser console errors

## 10. Testing Strategy

- **Vitest** for all unit tests
- Backend: in-memory SQLite (via `prisma` with `DATABASE_URL="file:./test.db"`)
- Frontend component tests: `@testing-library/react`
- Mock strategy for AI calls: `vi.mock()` on `ai.service.ts`
- Phase 6 includes full manual e2e browser walkthrough

## 11. Error Handling

- Backend: global error middleware returning `{ error: string, status: number }`
- Failed AI calls: return fallback analysis, never crash the request
- Frontend: each page handles loading, empty, error states
- Network errors: toast notification via shadcn `sonner` toast
- Timer edge cases: tab hidden during practice, system sleep — timer pauses (consistent with real test where the clock keeps running; on wake, timer continues from where it left off — the student loses that time, same as real test)