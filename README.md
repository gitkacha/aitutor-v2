# NSW Selective Writing Coach

A writing-practice and progress-tracking tool for students preparing for the **Writing component of the NSW Selective High School Placement Test**. It runs locally on your own computer — no login, no cloud, no internet needed (other than optional AI analysis).

## Quick Start

```bash
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

## Features

### Timed Practice
- 11 text types tested in the Selective exam: Advertisement, Advice Sheet, Diary Entry, Discussion, Guide, Letter, Narrative/Creative, News Report, Persuasive, Review, Speech
- Realistic 30-minute countdown timer matching the actual test
- Distraction-free writing screen with live word count
- Auto-submit when time runs out, or submit early
- No spellcheck or autocorrect — mirrors real test conditions

### Progress Dashboard
- Colour-coded heatmap showing performance across all text types at a glance
- Click any cell to see score history over time with a line chart
- Empty state with encouragement to start practising
- Red→green performance scale (exempt from brand palette)

### In-Depth AI Analysis
- Every attempt gets AI-generated feedback covering:
  - **Vocabulary** — word choice, range, and precision
  - **Sentence Structure & Flow** — variety, rhythm, and transitions
  - **Content & Structure** — how well it follows the text type's expected structure
- Specific, quotable feedback tied to the student's actual writing

### Admin Dashboard
- Toggle to admin view (no login needed — single-student local tool)
- Same heatmap with worksheet generation controls
- **Generate Worksheet** — AI creates targeted prompts for the weakest text types
- **Load Demo Data** — populates realistic sample attempts, analyses, and a completed worksheet for demonstration
- **Clear Demo Data** — removes only demo records, leaving real student work untouched

### Worksheet Tracking
- Worksheet attempts are tracked identically to practice tests in the heatmap and history
- Worksheets are reviewed before assignment

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
│   │   ├── schema.prisma     # Data model
│   │   └── seed.ts           # 11 types + 55 prompts
│   └── src/
│       ├── index.ts          # Express server (port 3001)
│       ├── routes/           # API routes (types, attempts, analysis, heatmap, worksheets, demo)
│       ├── services/         # AI service (OpenRouter), demo data service
│       └── middleware/       # Error handling
├── frontend/
│   └── src/
│       ├── App.tsx           # Layout: sidebar + router
│       ├── components/       # UI components (Sidebar, Timer, Heatmap, etc.)
│       ├── pages/            # Page components (Dashboard, PracticeHome, TimedPractice, etc.)
│       ├── hooks/            # React hooks (useHeatmap)
│       └── lib/              # API client, utilities
└── docs/
    └── superpowers/          # Design doc and implementation plan
```

## API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/api/types` | List all writing types |
| GET | `/api/types/:slug` | One type with its prompts |
| POST | `/api/attempts` | Save a completed attempt |
| GET | `/api/attempts/:id` | Get attempt with analysis |
| GET | `/api/attempts` | List attempts, optional `?type=slug` filter |
| POST | `/api/analysis/:attemptId` | Trigger AI analysis |
| GET | `/api/heatmap` | Aggregated scores per type |
| POST | `/api/worksheets/generate` | AI-generate worksheet |
| GET | `/api/worksheets` | List worksheets |
| POST | `/api/demo/load` | Seed demo data |
| POST | `/api/demo/clear` | Remove demo data |

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