# NSW Selective Prep Coach

A comprehensive practice and progress-tracking tool for students preparing for the **NSW Selective High School Placement Test**. Covers **Writing** (11 text types) and **Mathematical Reasoning** (20 topic categories). It runs locally on your own computer — no login, no cloud, no internet needed (other than optional AI analysis).

## Quick Start

```bash
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

## Features

### Writing — Timed Practice
- 11 text types tested in the Selective exam: Advertisement, Advice Sheet, Diary Entry, Discussion, Guide, Letter, Narrative/Creative, News Report, Persuasive, Review, Speech
- Realistic 30-minute countdown timer matching the actual test
- Distraction-free writing screen with live word count
- Auto-submit when time runs out, or submit early
- No spellcheck or autocorrect — mirrors real test conditions
- Every attempt gets AI-generated feedback covering vocabulary, sentence structure, and content

### Mathematics — Timed Practice
- 20 topic categories from the Mathematical Reasoning section: Number Sentences, Probability, Combinations, Arithmetic, Patterns, Protractor Skills, Time, Magic Squares, Data Interpretation, Time Zones, Number Place Values, Multiples and Factors, Fractions, Lowest Common Multiple, Algebra, Perimeter, Directions, Weight, Speed Distance Time, Rotation
- **Single-topic practice** or **All Topics** 35-question mixed test
- 5-option multiple choice, matching the real trial test format
- Timed proportionally (~69 seconds per question, max 40 minutes)
- Stimulus groups for shared-context questions (e.g. a line graph with 4 related questions)
- Instant scoring with per-topic breakdown
- Full answer review with correct answers highlighted and worked explanations

### Progress Dashboard
- Colour-coded heatmap showing **Writing** performance across 11 text types
- Second heatmap showing **Mathematics** performance across 20 topics
- Click any cell to see score history over time with a line chart
- Empty state with encouragement to start practising
- Red→green performance scale (exempt from brand palette)

### In-Depth AI Analysis (Writing)
- Every Writing attempt gets AI-generated feedback covering:
  - **Vocabulary** — word choice, range, and precision
  - **Sentence Structure & Flow** — variety, rhythm, and transitions
  - **Content & Structure** — how well it follows the text type's expected structure
- Specific, quotable feedback tied to the student's actual writing

### Admin Dashboard
- Toggle to admin view (no login needed — single-student local tool)
- Tabbed interface for **Writing** and **Mathematics** controls
- **Generate Writing Worksheet** — AI creates targeted prompts for the weakest text types
- **Generate Mathematics Worksheet** — select specific topics or auto-generate a 35-question mixed-topic worksheet at reference-test difficulty
- Review generated math questions before saving
- **Load Demo Data** — populates realistic sample attempts, analyses, and worksheets for both subjects
- **Clear Demo Data** — removes only demo records, leaving real student work untouched

### Worksheet Tracking
- Worksheet attempts are tracked identically to practice tests in the heatmap and history
- Worksheets are reviewed before assignment
- Mathematics worksheet performance rolls into the same per-topic heatmap

## Build Progress

All 12 phases are complete. Both **Writing** and **Mathematics** subjects are fully implemented.

| Phase | Feature | Status |
|---|---|---|
| 1 | Running skeleton and data (sidebar, SQLite, seed) | ✅ Complete |
| 2 | Timed practice test (30-min countdown, auto-submit) | ✅ Complete |
| 3 | Progress tracking and heatmap (per-type scores, drill-down) | ✅ Complete |
| 4 | In-depth AI analysis (vocabulary, sentence structure, content) | ✅ Complete |
| 5 | Admin, AI-assisted worksheets, demo data load/clear | ✅ Complete |
| 6 | Look and feel polish, banned element sweep, E2E validation | ✅ Complete |
| 7a | Mathematics schema migration + seed (20 topics, 35 questions, stimulus groups) | ✅ Complete |
| 7b | Mathematics API routes + sidebar accordion | ✅ Complete |
| 8-9 | Mathematics timed practice + scoring/review (question-by-question, 5 options, proportional timer) | ✅ Complete |
| 10 | Mathematics heatmap in Dashboard with per-topic drill-down | ✅ Complete |
| 11 | Admin math tab, topic selector, 35-question worksheet generation, AI difficulty calibration, demo data | ✅ Complete |
| 12 | E2E verification, brand palette compliance, README | ✅ Complete |

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Express, TypeScript, Prisma ORM |
| **Database** | SQLite (local file) |
| **Charts** | Recharts |
| **AI** | OpenRouter API (`openrouter/free`) |
| **Testing** | Vitest |

## Project Structure

```
coach/
├── package.json              # Root workspace — single npm run dev
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # Data model (10 models: Writing + Mathematics)
│   │   └── seed.ts           # 11 writing types + 55 prompts + 20 math topics + 35 questions
│   └── src/
│       ├── index.ts          # Express server (port 3001)
│       ├── routes/           # API routes (writing + math topics, questions, attempts, heatmap, worksheets, demo)
│       ├── services/         # AI service (OpenRouter), demo data service
│       └── middleware/       # Error handling
├── frontend/
│   └── src/
│       ├── App.tsx           # Layout: sidebar + router
│       ├── components/       # UI components (Sidebar, Timer, Heatmap, MathQuestionCard, etc.)
│       ├── pages/            # Page components (Dashboard, PracticeHome, TimedPractice, MathPracticeHome, etc.)
│       ├── hooks/            # React hooks (useHeatmap)
│       └── lib/              # API client, utilities
└── docs/
    └── superpowers/          # Design doc, implementation plan, reference PDFs
```

## API Endpoints

### Writing

| Method | Route | Description |
|---|---|---|
| GET | `/api/types` | List all writing types |
| GET | `/api/types/:slug` | One type with its prompts |
| POST | `/api/attempts` | Save a completed attempt |
| GET | `/api/attempts/:id` | Get attempt with analysis |
| GET | `/api/attempts` | List attempts, optional `?type=slug` filter |
| POST | `/api/analysis/:attemptId` | Trigger AI analysis |
| GET | `/api/heatmap` | Aggregated scores per writing type |
| POST | `/api/worksheets/generate` | AI-generate writing worksheet |
| GET | `/api/worksheets` | List worksheets |

### Mathematics

| Method | Route | Description |
|---|---|---|
| GET | `/api/math/topics` | List all 20 math topics |
| GET | `/api/math/topics/:slug` | One topic with its seeded questions |
| GET | `/api/math/questions` | Get questions for practice (`?topic=slug` or all-topics) |
| POST | `/api/math/attempts` | Save completed attempt (auto-scores + per-topic breakdown) |
| GET | `/api/math/attempts/:id` | Get attempt with full question details |
| GET | `/api/math/attempts` | List attempts, optional `?topic=slug` filter |
| GET | `/api/math/heatmap` | Aggregated scores per math topic |
| POST | `/api/math/worksheets/generate` | AI-generate 35-question math worksheet |
| POST | `/api/math/worksheets/save` | Save reviewed math worksheet |
| GET | `/api/math/worksheets` | List math worksheets |

### Demo Data

| Method | Route | Description |
|---|---|---|
| POST | `/api/demo/load` | Seed demo data (both subjects) |
| POST | `/api/demo/clear` | Remove all demo records |

## Configuration

Copy the `.env` file to configure the OpenRouter API key for AI analysis:

```env
OPENROUTER_API_KEY=your-key-here
```

The app works without it — AI analysis will use fallback scores, and all other features function normally.

## Development

```bash
# Start both servers
npm run dev

# Run tests
npm test

# Reset database
npm run db:reset

# Re-seed database
npm run db:seed
```

The frontend (port 5173) proxies `/api` requests to the backend (port 3001).

## Color Palette

| Use | Colour |
|---|---|
| **Brand Blue** | `#1c6dd0` |
| **Brand Green** | `#2e9e5b` |
| **Brand Amber** | `#f2a71b` |
| **Heatmap** | Red → Yellow → Green (exempt from brand palette) |

## Licence

Private — for personal and educational use.