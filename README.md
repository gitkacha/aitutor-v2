# NSW Selective Prep Coach

A comprehensive practice and progress-tracking tool for students preparing for the **NSW Selective High School Placement Test**. Covers **Writing** (11 text types) and **Mathematical Reasoning** (20 topic categories). It runs locally on your own computer — no cloud and no internet needed (other than optional AI analysis). It is **multi-user and multi-tenant**: a workspace holds admins (tutors/parents) and students, each signing in with their own account.

## Quick Start

```bash
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

**First run:** a brand-new install has no accounts, so you land on a one-time **setup screen** that creates your first workspace and its first admin (who is also the platform super-admin). Sign in with those credentials, then add students and other admins from the Admin page.

**Trying the demo:** if you started from a database that already had practice data, it was migrated into a **Demo Workspace** with two accounts (default password `demo1234`):

| Account | Email | Role |
|---|---|---|
| Demo Admin | `demo-admin@demo.local` | admin **+ super-admin** |
| Demo Student | `demo-student@demo.local` | student |

## Workspaces, accounts & roles

- A **Workspace** is the top-level tenant. Curriculum (writing types, math topics, question banks) is shared globally; attempts, analyses, worksheets and assignments are scoped to a workspace.
- **Students** sign in and see only their own performance, opportunity areas, and the worksheets assigned to them.
- **Admins** generate worksheets and assign them to chosen students, view any student's performance in their workspace, and manage workspace members.
- A **super-admin** (the demo admin, and any fresh-install first admin) can additionally provision new workspaces — each with its own first admin — and view any workspace's members and performance read-only, from a **Platform** console. Per-workspace admins are then delegated all day-to-day actions in their own workspace.
- **Authentication** is password-based (bcrypt) behind a swappable *identity-provider* interface, so a third-party IdP (e.g. Auth0/OIDC) can replace the local provider without touching routes or UI. Sessions are signed HTTP-only cookies (`SESSION_SECRET`).

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
- **Rendered visual stimuli** — questions that need a picture show a real one: protractors, line/bar/pie charts, tables, grids (magic squares, tile patterns), compass roses, labelled shapes, rotated-shape pairs, and value cards, all rendered from structured figure data (charts via Recharts, geometry via parametric SVG). AI-generated worksheet questions can carry the same figures, the answer-key verifier re-solves each question from exactly what the student sees, and questions referencing a visual without providing one are discarded and regenerated. Upgrading an existing install: run `npm run db:seed` once to attach the repaired figures to the built-in question bank.
- Instant scoring with per-topic breakdown
- Full answer review with correct answers highlighted and worked explanations

### "Evening Navy" Sidebar
- Solid deep-navy rail with a **weekly momentum ring** — "N of 5 sessions done this week" celebrates effort, not just scores
- A colour-coded score sits next to every writing type and maths topic (a quiet "—" when untouched); collapsed sections show all topics as a micro-heatmap strip
- **"Up next" card** — the oldest pending worksheet is one tap away from the sidebar footer
- **Focus mode** — during any timed test the rail collapses to a slim icon strip so nothing competes with the countdown

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
- Signed-in admin view (admins only; students never see it)
- **Assign worksheets to chosen students** at save time (select-all by default)
- **Per-student performance** — a selector scopes both heatmaps to any student in the workspace, or the whole-workspace aggregate
- **Workspace Members** — list members and add new students or admins
- Tabbed interface for **Writing** and **Mathematics** controls
- **Generate Writing Worksheet** — AI creates targeted prompts for the weakest text types
- **Generate Mathematics Worksheet** — select specific topics (or all), choose the question count (5–50, default 35); generation is batched so the worksheet always contains exactly that many questions, at reference-test difficulty. Students get 1 minute per question.
- **Answer-key verification** — every generated question is independently re-solved by the reasoning model; questions whose answer key can't be confirmed, or with duplicate/equivalent options, are discarded and regenerated
- Review generated math questions before saving
- **Load Demo Data** — populates realistic sample attempts, analyses, and worksheets for both subjects
- **Clear Demo Data** — removes only demo records, leaving real student work untouched

### Worksheet Tracking
- **Pending Worksheets quick view** — unattempted worksheets from both subjects are listed on the student Dashboard (with one-click start) and on the Admin page, no need to check each topic section
- Worksheet attempts are tracked identically to practice tests in the heatmap and history
- Worksheets are reviewed before assignment
- Mathematics worksheet performance rolls into the same per-topic heatmap

## Build Progress

Milestone 1 (all 12 subject phases) is complete for both **Writing** and **Mathematics**.
**Milestone 2 — multi-user, multi-tenant workspaces** is complete: workspace/user schema with a
conditional demo-workspace migration, password auth behind a swappable identity-provider seam,
per-workspace scoping and authorization, login/first-run-setup UI, the admin assignment picker /
per-student views / member management, the student opportunity-areas dashboard, and a super-admin
Platform console for provisioning and read-only oversight.

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
| **AI** | OpenAI API — `gpt-5-mini` (worksheet generation + answer-key verification), `gpt-4o-mini` (writing analysis) |
| **Testing** | Vitest (unit) + Playwright (end-to-end) |

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

All data routes require a session; student requests are scoped to the caller, and admins may
pass `?studentId=` (a member of their workspace) to view one student. Worksheet `save` accepts
`studentIds[]` to target an assignment.

### Auth, workspaces & platform

| Method | Route | Description |
|---|---|---|
| GET | `/api/setup/status` | Whether a first-run setup is needed (zero users) |
| POST | `/api/setup` | First-run: create the first workspace + admin (super-admin) |
| POST | `/api/auth/login` · `/logout` | Sign in / out (session cookie) |
| GET | `/api/auth/me` | The signed-in user, or 401 |
| GET · POST | `/api/workspace/users` | Admin: list / add members of their own workspace |
| GET | `/api/superadmin/workspaces` | Super-admin: list all workspaces |
| POST | `/api/superadmin/workspaces` | Super-admin: create a workspace + its first admin |
| GET | `/api/superadmin/workspaces/:id` | Super-admin: read-only oversight (members + performance) |

### Demo Data

| Method | Route | Description |
|---|---|---|
| POST | `/api/demo/load` | Seed demo data into the caller's workspace (admin) |
| POST | `/api/demo/clear` | Remove the caller workspace's demo records (admin) |

## Configuration

Create a `backend/.env` file to configure the OpenAI API key for AI analysis:

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=your-key-here

# Signs the session cookie — set a strong random value in any shared/hosted deployment.
# A local dev default is used if unset.
SESSION_SECRET=change-me

# Optional model overrides (defaults shown)
GENERATION_MODEL=gpt-5-mini
ANALYSIS_MODEL=gpt-4o-mini
```

Without a key, AI writing analysis shows an "unavailable" message with a Retry button (no fake
scores are ever recorded), and worksheet generation falls back to built-in sample content. All
other features function normally.

## Development

```bash
# Start both servers
npm run dev

# Run unit tests
npm test

# Typecheck both workspaces
npm run typecheck

# Run end-to-end tests (isolated DB and ports; safe to run alongside dev servers)
npm run e2e

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