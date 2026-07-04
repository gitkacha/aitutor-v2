# NSW Selective Writing Coach — Full Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build a complete writing-practice and progress-tracking app for the NSW Selective High School Placement Test Writing component.

**Architecture:** Monorepo with Express + TypeScript backend (Prisma/SQLite, OpenRouter proxy) and Vite + React 18 + TypeScript frontend (Tailwind/shadcn/ui, Recharts). Single `npm run dev` starts both.

**Tech Stack:** Vite, React 18, TypeScript, Express, Prisma, SQLite, Tailwind CSS, shadcn/ui, Recharts, React Router v6, Vitest, concurrently

## Global Constraints

- Brand palette: `#1c6dd0` (blue), `#2e9e5b` (green), `#f2a71b` (amber) + grays
- Heatmap exempt from brand palette (red→yellow→green scale)
- No background gradients, purple backgrounds, gradient buttons, or single-side accent borders
- AI calls use `openrouter/free` model via OpenRouter API
- All data stored locally in SQLite via Prisma
- Admin is a toggle, not a login
- No pagination, no auth, no multi-user

---

## Phase 1 — Running Skeleton and Data

### Task 1.1: Scaffold root monorepo and backend package

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/package.json`
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/package.json`
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/tsconfig.json`
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/prisma/schema.prisma`

**Interfaces:**
- Consumes: nothing
- Produces: root `npm run dev` that starts both servers; Prisma schema file

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "nsw-selective-writing-coach",
  "private": true,
  "scripts": {
    "dev": "concurrently -n backend,frontend -c blue,green \"npm run dev -w backend\" \"npm run dev -w frontend\"",
    "test": "npm run test -w backend && npm run test -w frontend",
    "db:migrate": "npm run db:migrate -w backend",
    "db:seed": "npm run db:seed -w backend",
    "db:reset": "npm run db:reset -w backend",
    "postinstall": "npm run db:migrate -w backend && npm run db:seed -w backend"
  },
  "workspaces": ["backend", "frontend"],
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 2: Create backend/package.json**

```json
{
  "name": "backend",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "prisma migrate dev --name init",
    "db:seed": "tsx prisma/seed.ts",
    "db:reset": "prisma migrate reset --force"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "cors": "^2.8.5",
    "express": "^4.21.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.9.0",
    "prisma": "^5.22.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 3: Create backend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src", "prisma"]
}
```

- [ ] **Step 4: Create Prisma schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model WritingType {
  id                Int       @id @default(autoincrement())
  name              String
  slug              String    @unique
  description       String
  expectedStructure String
  isDemo            Boolean   @default(false)
  prompts           Prompt[]
  attempts          Attempt[]
}

model Prompt {
  id        Int       @id @default(autoincrement())
  text      String
  typeId    Int
  isDemo    Boolean   @default(false)
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
  timeTaken   Int
  source      String
  worksheetId Int?
  isDemo      Boolean   @default(false)
  type        WritingType @relation(fields: [typeId], references: [id])
  prompt      Prompt      @relation(fields: [promptId], references: [id])
  worksheet   Worksheet?  @relation(fields: [worksheetId], references: [id])
  analysis    Analysis?
}

model Analysis {
  id                Int     @id @default(autoincrement())
  attemptId         Int     @unique
  vocabScore        Int
  vocabComments     String
  structureScore    Int
  structureComments String
  contentScore      Int
  contentComments   String
  overallScore      Int
  summary           String
  isDemo            Boolean @default(false)
  attempt           Attempt @relation(fields: [attemptId], references: [id])
}

model Worksheet {
  id        Int       @id @default(autoincrement())
  title     String
  typeId    Int
  prompts   String
  createdAt DateTime  @default(now())
  isDemo    Boolean   @default(false)
  attempts  Attempt[]
}
```

- [ ] **Step 5: Create backend/.env**

```
DATABASE_URL="file:./dev.db"
OPENROUTER_API_KEY=your-key-here
PORT=3001
```

- [ ] **Step 6: Install dependencies**

Run: `cd /Users/km/AI/projects/claude-proj/coach && npm install`

Expected: All workspaces installed, Prisma client generated, migration run

- [ ] **Step 7: Verify migration**

Run: `ls /Users/km/AI/projects/claude-proj/coach/backend/prisma/migrations/`
Expected: At least one migration directory exists

---

### Task 1.2: Create seed data

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/prisma/seed.ts`

**Interfaces:**
- Consumes: Prisma schema from Task 1.1
- Produces: Database seeded with 11 WritingTypes + 55 Prompts

- [ ] **Step 1: Write seed.ts**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WRITING_TYPES = [
  {
    name: 'Advertisement',
    slug: 'advertisement',
    description: 'A persuasive text that promotes a product, service, or event using compelling language and visual elements to convince an audience to take action.',
    expectedStructure: 'Headline/attention-grabber, description of product/service, persuasive features/benefits, call to action',
    prompts: [
      'Create an advertisement for a new type of reusable water bottle that filters water as you drink.',
      'Design an advertisement for a community gardening program in your local neighbourhood.',
      'Write an advertisement for a "Book-Borrowing Café" where you can read while enjoying coffee.',
      'Create an advertisement for a new app that helps students organise their homework and study schedules.',
      'Design an advertisement for a school talent show fundraiser.'
    ]
  },
  {
    name: 'Advice Sheet',
    slug: 'advice-sheet',
    description: 'An instructional text that provides practical guidance, tips, and recommendations on a specific topic to help the reader achieve a goal or solve a problem.',
    expectedStructure: 'Title/heading, introduction stating the purpose, numbered or bulleted tips/advice, conclusion or final encouragement',
    prompts: [
      'Write an advice sheet for students starting at a new school, offering tips on how to settle in and make friends.',
      'Create an advice sheet titled "How to Prepare for a Big Test" aimed at Year 6 students.',
      'Write an advice sheet for young children on how to stay safe when walking to school alone.',
      'Create an advice sheet for someone who wants to start a small vegetable garden at home.',
      'Write an advice sheet on how to manage screen time and develop healthy digital habits.'
    ]
  },
  {
    name: 'Diary Entry',
    slug: 'diary-entry',
    description: 'A personal, reflective text written in first person that records experiences, thoughts, and feelings about events from the writer\'s perspective.',
    expectedStructure: 'Date/salutation, description of events in chronological order, personal reflections and feelings, closing thought',
    prompts: [
      'Write a diary entry about the day you discovered a hidden talent you never knew you had.',
      'Write a diary entry from the perspective of a child who just moved to Australia from another country on their first day of school.',
      'Write a diary entry about a day when everything went wrong — but ended up being surprisingly wonderful.',
      'Write a diary entry from the perspective of an astronaut who just stepped onto Mars for the first time.',
      'Write a diary entry about the day your family adopted a pet from the animal shelter.'
    ]
  },
  {
    name: 'Discussion',
    slug: 'discussion',
    description: 'A balanced text that explores multiple perspectives on an issue, presenting arguments for and against before reaching a reasoned conclusion.',
    expectedStructure: 'Introduction stating the issue, arguments for (with evidence), arguments against (with evidence), balanced conclusion',
    prompts: [
      'Discuss whether all students should be required to learn a second language at school.',
      'Discuss the pros and cons of having a four-day school week with longer hours each day.',
      'Discuss whether homework should be banned in primary schools.',
      'Discuss the benefits and drawbacks of social media for young people.',
      'Discuss whether schools should replace traditional books with tablets and laptops.'
    ]
  },
  {
    name: 'Guide',
    slug: 'guide',
    description: 'A how-to text that explains a process or system, providing clear instructions and useful information to help the reader navigate or accomplish something.',
    expectedStructure: 'Title and introduction, step-by-step instructions or sections, tips and warnings, summary or next steps',
    prompts: [
      'Write a guide for international visitors on how to use Sydney\'s public transport system.',
      'Create a guide for young students on how to organise a successful fundraising event at school.',
      'Write a guide titled "How to Build a Worm Farm" for a school environmental club.',
      'Create a guide for new school library monitors on how to run the library during lunch breaks.',
      'Write a guide for students on how to prepare and present a compelling oral presentation.'
    ]
  },
  {
    name: 'Letter',
    slug: 'letter',
    description: 'A formal or informal written correspondence addressing a specific person or organisation to convey information, request action, or express views.',
    expectedStructure: 'Salutation, introduction stating purpose, body paragraphs with details, closing and signature',
    prompts: [
      'Write a letter to the principal arguing for a new outdoor play area or sports facility at your school.',
      'Write a letter to a local newspaper expressing your views on whether kids should have more say in community decisions.',
      'Write a letter to a pen pal in another country describing what life is like in your Australian town or city.',
      'Write a letter to a favourite author telling them how their book influenced you and asking a question about their writing.',
      'Write a letter to your future self to be opened in ten years, describing your hopes and dreams.'
    ]
  },
  {
    name: 'Narrative/Creative',
    slug: 'narrative-creative',
    description: 'A fictional or semi-fictional story that engages the reader through character, setting, plot, and descriptive language to entertain or convey a message.',
    expectedStructure: 'Orientation (character/setting), complication/conflict, rising action, climax, resolution',
    prompts: [
      'Write a story that begins with the sentence: "The moment I opened the door, I knew nothing would ever be the same again."',
      'Write a story about a child who discovers a mysterious map hidden inside an old book at the library.',
      'Write a story about a friendship that forms between two very different people during a school camping trip.',
      'Write a story set in a world where the sun never sets, and one day it suddenly begins to get dark.',
      'Write a story about a young person who must overcome a fear to help someone else in need.'
    ]
  },
  {
    name: 'News Report',
    slug: 'news-report',
    description: 'A factual account of a recent event written in journalistic style, providing key information about who, what, where, when, why, and how.',
    expectedStructure: 'Headline, byline/dateline, lead paragraph (5 Ws), body with details, quotes from witnesses/experts, closing paragraph',
    prompts: [
      'Write a news report about a local community that came together to save a historic building from demolition.',
      'Write a news report about a school\'s environmental initiative that has inspired other schools across the state.',
      'Write a news report about a young inventor who created a device to help clean up ocean plastic.',
      'Write a news report about a major sporting event where an underdog team achieved an unexpected victory.',
      'Write a news report about a rare natural phenomenon that was visible in your town last night.'
    ]
  },
  {
    name: 'Persuasive',
    slug: 'persuasive',
    description: 'A text that aims to convince the reader to adopt a particular viewpoint or take a specific action through reasoned argument and rhetorical devices.',
    expectedStructure: 'Introduction with thesis statement, arguments with supporting evidence (each in its own paragraph), counter-argument and rebuttal, strong conclusion',
    prompts: [
      'Argue for or against the idea that every school should have a student-run newspaper or media club.',
      'Persuade your local council to build a new skate park or youth recreation centre in your area.',
      'Argue whether Australia should do more to protect its native wildlife from extinction.',
      'Persuade your school to introduce a "no homework on weekends" policy.',
      'Argue whether kids should be allowed to have their own mobile phones before high school.'
    ]
  },
  {
    name: 'Review',
    slug: 'review',
    description: 'A critical evaluation of a product, service, experience, or creative work that provides an opinion supported by evidence and a recommendation.',
    expectedStructure: 'Introduction naming what is reviewed, overall impression, specific aspects evaluated (with evidence), rating, recommendation',
    prompts: [
      'Write a review of a book you have read recently, discussing its plot, characters, and whether you would recommend it.',
      'Write a review of a new restaurant or café in your area, covering the food, service, atmosphere, and value for money.',
      'Write a review of a video game or app that you enjoy, discussing its gameplay, graphics, and replay value.',
      'Write a review of a movie or TV show you watched recently, evaluating the story, acting, and production quality.',
      'Write a review of a museum exhibit or gallery you visited on a school excursion.'
    ]
  },
  {
    name: 'Speech',
    slug: 'speech',
    description: 'A text written to be delivered orally to an audience,using rhetorical devices and persuasive language to inform, inspire, or persuade listeners.',
    expectedStructure: 'Greeting/acknowledgment of audience, introduction with hook, body with key points, rhetorical devices, memorable conclusion',
    prompts: [
      'Write a speech for school captain arguing that "kindness is the most important quality a leader can have."',
      'Write a speech to deliver at a school assembly about why your school should participate in a national tree-planting day.',
      'Write a speech for a debate arguing that "technology brings people closer together."',
      'Write a speech to welcome new students to your school, helping them feel excited and supported.',
      'Write a speech for a fundraising event to support a cause you care deeply about.'
    ]
  }
];

async function main() {
  console.log('Seeding database...');

  for (const wt of WRITING_TYPES) {
    const { prompts, ...typeData } = wt;
    const created = await prisma.writingType.upsert({
      where: { slug: typeData.slug },
      update: typeData,
      create: typeData,
    });

    for (const promptText of prompts) {
      await prisma.prompt.create({
        data: {
          text: promptText,
          typeId: created.id,
        },
      });
    }

    console.log(`  ✓ ${typeData.name} (${prompts.length} prompts)`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Run the seed**

Run: `cd /Users/km/AI/projects/claude-proj/coach && npm run db:seed`
Expected: 11 writing types created with 5 prompts each, all "✓" messages printed

---

### Task 1.3: Express server with /api/types route

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/src/index.ts`
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/src/middleware/error.ts`
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/src/routes/types.ts`

**Interfaces:**
- Consumes: Prisma client, WritingType model
- Produces: Express server on port 3001, GET /api/types, GET /api/types/:slug

- [ ] **Step 1: Create prisma client singleton**

Create `/Users/km/AI/projects/claude-proj/coach/backend/src/lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
```

- [ ] **Step 2: Create error middleware**

```typescript
// backend/src/middleware/error.ts
import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error', status: 500 });
}
```

- [ ] **Step 3: Create types route**

```typescript
// backend/src/routes/types.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const types = await prisma.writingType.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(types);
});

router.get('/:slug', async (req: Request, res: Response) => {
  const type = await prisma.writingType.findUnique({
    where: { slug: req.params.slug },
    include: { prompts: true },
  });
  if (!type) {
    res.status(404).json({ error: 'Writing type not found', status: 404 });
    return;
  }
  res.json(type);
});

export default router;
```

- [ ] **Step 4: Create Express server entry**

```typescript
// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error';
import typesRouter from './routes/types';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/types', typesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

export default app;
```

- [ ] **Step 5: Test the server starts**

Run: `cd /Users/km/AI/projects/claude-proj/coach/backend && npx tsx src/index.ts & sleep 2 && curl http://localhost:3001/api/health && kill %1`
Expected: `{"status":"ok"}`

- [ ] **Step 6: Test /api/types returns seeded types**

Run: `cd /Users/km/AI/projects/claude-proj/coach/backend && npx tsx src/index.ts & sleep 2 && curl http://localhost:3001/api/types | head -c 200 && kill %1`
Expected: JSON array with 11 writing types

---

### Task 1.4: Scaffold frontend (Vite + React + Tailwind + shadcn/ui)

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/package.json`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/tsconfig.json`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/vite.config.ts`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/tailwind.config.ts`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/postcss.config.js`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/index.html`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/main.tsx`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/index.css`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/App.tsx`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/lib/utils.ts`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/lib/api.ts`

- [ ] **Step 1: Create frontend/package.json**

```json
{
  "name": "frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "recharts": "^2.13.3",
    "lucide-react": "^0.460.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.5"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "^5.6.3",
    "vite": "^6.0.0",
    "vitest": "^2.1.5",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.6.3",
    "jsdom": "^25.0.1"
  }
}
```

- [ ] **Step 2: Create frontend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 4: Create tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1c6dd0',
          green: '#2e9e5b',
          amber: '#f2a71b',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NSW Selective Writing Coach</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  @apply bg-gray-50 text-gray-900 antialiased;
}

@layer base {
  :root {
    --brand-blue: #1c6dd0;
    --brand-green: #2e9e5b;
    --brand-amber: #f2a71b;
  }
}
```

- [ ] **Step 8: Create src/lib/utils.ts**

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 9: Create src/lib/api.ts**

```typescript
const API_BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface WritingType {
  id: number;
  name: string;
  slug: string;
  description: string;
  expectedStructure: string;
  prompts?: Prompt[];
}

export interface Prompt {
  id: number;
  text: string;
  typeId: number;
}

export interface Attempt {
  id: number;
  typeId: number;
  promptId: number;
  text: string;
  startedAt: string;
  finishedAt: string;
  timeTaken: number;
  source: string;
  worksheetId: number | null;
  analysis?: Analysis | null;
}

export interface Analysis {
  id: number;
  attemptId: number;
  vocabScore: number;
  vocabComments: string;
  structureScore: number;
  structureComments: string;
  contentScore: number;
  contentComments: string;
  overallScore: number;
  summary: string;
}

export interface HeatmapEntry {
  typeId: number;
  typeName: string;
  typeSlug: string;
  averageScore: number | null;
  attemptCount: number;
}

export interface Worksheet {
  id: number;
  title: string;
  typeId: number;
  prompts: string;
  createdAt: string;
}

export const api = {
  getTypes: () => fetchJSON<WritingType[]>('/types'),
  getType: (slug: string) => fetchJSON<WritingType>(`/types/${slug}`),
  getAttempts: (typeSlug?: string) =>
    fetchJSON<Attempt[]>(`/attempts${typeSlug ? `?type=${typeSlug}` : ''}`),
  getAttempt: (id: number) => fetchJSON<Attempt>(`/attempts/${id}`),
  createAttempt: (data: Partial<Attempt> & { text: string; promptId: number; typeId: number }) =>
    fetchJSON<Attempt>('/attempts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  triggerAnalysis: (attemptId: number) =>
    fetchJSON<Analysis>(`/analysis/${attemptId}`, { method: 'POST' }),
  getHeatmap: () => fetchJSON<HeatmapEntry[]>('/heatmap'),
  generateWorksheet: (typeIds: number[]) =>
    fetchJSON<Worksheet>('/worksheets/generate', {
      method: 'POST',
      body: JSON.stringify({ typeIds }),
    }),
  getWorksheets: () => fetchJSON<Worksheet[]>('/worksheets'),
  loadDemo: () => fetchJSON<{ message: string }>('/demo/load', { method: 'POST' }),
  clearDemo: () => fetchJSON<{ message: string }>('/demo/clear', { method: 'POST' }),
};
```

- [ ] **Step 10: Create src/main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 11: Create src/App.tsx (skeleton for now)**

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';

export default function App() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <div className="text-center py-20">
                <h1 className="text-2xl font-semibold text-gray-700">Progress Dashboard</h1>
                <p className="text-gray-500 mt-2">No attempts yet. Start practising to see your progress.</p>
              </div>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 12: Install frontend dependencies**

Run: `cd /Users/km/AI/projects/claude-proj/coach && npm install`
Expected: No errors

---

### Task 1.5: Sidebar component

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/components/Sidebar.tsx`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/components/ui/button.tsx`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/components/ui/accordion.tsx`

- [ ] **Step 1: Create shadcn-style button component**

```typescript
// frontend/src/components/ui/button.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue/50',
          {
            'bg-brand-blue text-white hover:bg-brand-blue/90': variant === 'default',
            'hover:bg-gray-100 text-gray-700': variant === 'ghost',
            'border border-gray-300 hover:bg-gray-50 text-gray-700': variant === 'outline',
          },
          {
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4 text-sm': size === 'md',
            'h-12 px-6 text-base': size === 'lg',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
```

- [ ] **Step 2: Create Sidebar component**

```typescript
// frontend/src/components/Sidebar.tsx
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { api, WritingType } from '@/lib/api';
import { FileText, ChevronDown, ChevronRight, Menu, X } from 'lucide-react';

export default function Sidebar() {
  const [types, setTypes] = useState<WritingType[]>([]);
  const [writingExpanded, setWritingExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api.getTypes().then(setTypes).catch(() => {});
  }, []);

  const isActive = (slug: string) => location.pathname.includes(slug);

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 h-full transition-transform',
          'lg:relative lg:translate-x-0',
          mobileOpen ? 'fixed inset-y-0 left-0 z-40 translate-x-0' : 'fixed -translate-x-full lg:relative lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-brand-blue">Writing Coach</h1>
          <p className="text-xs text-gray-500 mt-0.5">NSW Selective Preparation</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Dashboard link */}
          <Link
            to="/dashboard"
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              location.pathname === '/dashboard'
                ? 'bg-brand-blue/10 text-brand-blue font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            )}
            onClick={() => setMobileOpen(false)}
          >
            <FileText size={16} />
            Dashboard
          </Link>

          {/* Writing accordion */}
          <div>
            <button
              onClick={() => setWritingExpanded(!writingExpanded)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span>Writing</span>
              {writingExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {writingExpanded && (
              <div className="ml-2 mt-1 space-y-0.5">
                {types.map((type) => (
                  <Link
                    key={type.slug}
                    to={`/practice/${type.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                      isActive(type.slug)
                        ? 'bg-brand-blue/10 text-brand-blue font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    {type.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Admin link at bottom */}
        <div className="p-2 border-t border-gray-200">
          <Link
            to="/admin"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full',
              location.pathname === '/admin'
                ? 'bg-brand-blue/10 text-brand-blue font-medium'
                : 'text-gray-500 hover:bg-gray-100'
            )}
          >
            Admin
          </Link>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setMobileOpen(false)} />
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify the app starts and shows sidebar**

Run: `cd /Users/km/AI/projects/claude-proj/coach && npm run dev`
Wait for both servers to start, then open http://localhost:5173
Expected: Sidebar with "Writing Coach" header, Dashboard link, Writing accordion listing all 11 text types, Admin link at bottom

---

### Task 1.6: CRUD unit tests for phase 1 models

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/vitest.config.ts`
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/src/__tests__/types.test.ts`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/vitest.config.ts`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/__tests__/api.test.ts`

- [ ] **Step 1: Create backend vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 2: Create backend types test**

```typescript
// backend/src/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import prisma from '../lib/prisma';

describe('WritingType CRUD', () => {
  it('should read seeded writing types', async () => {
    const types = await prisma.writingType.findMany();
    expect(types.length).toBeGreaterThanOrEqual(11);
    expect(types.map(t => t.slug)).toContain('persuasive');
    expect(types.map(t => t.slug)).toContain('narrative-creative');
  });

  it('should find a writing type by slug', async () => {
    const type = await prisma.writingType.findUnique({ where: { slug: 'persuasive' } });
    expect(type).not.toBeNull();
    expect(type!.name).toBe('Persuasive');
  });

  it('should include prompts when querying a type', async () => {
    const type = await prisma.writingType.findUnique({
      where: { slug: 'narrative-creative' },
      include: { prompts: true },
    });
    expect(type?.prompts.length).toBeGreaterThanOrEqual(5);
  });

  it('should create a new prompt for a type', async () => {
    const type = await prisma.writingType.findUnique({ where: { slug: 'letter' } });
    const prompt = await prisma.prompt.create({
      data: { text: 'Test prompt', typeId: type!.id },
    });
    expect(prompt.id).toBeGreaterThan(0);
    await prisma.prompt.delete({ where: { id: prompt.id } });
  });
});
```

- [ ] **Step 3: Create frontend vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
  },
});
```

- [ ] **Step 4: Run backend tests**

Run: `cd /Users/km/AI/projects/claude-proj/coach/backend && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit Phase 1**

```bash
cd /Users/km/AI/projects/claude-proj/coach
git add -A
git commit -m "phase 1: running skeleton with sidebar, Prisma schema, seed data, Express server"
```

---

## Phase 2 — Timed Practice Test

### Task 2.1: PracticeHome page

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/pages/PracticeHome.tsx`
- Modify: `/Users/km/AI/projects/claude-proj/coach/frontend/src/App.tsx`

- [ ] **Step 1: Create PracticeHome page**

```typescript
// frontend/src/pages/PracticeHome.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, WritingType, Attempt } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Clock, ArrowRight } from 'lucide-react';

export default function PracticeHome() {
  const { typeSlug } = useParams<{ typeSlug: string }>();
  const navigate = useNavigate();
  const [type, setType] = useState<WritingType | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!typeSlug) return;
    Promise.all([
      api.getType(typeSlug),
      api.getAttempts(typeSlug),
    ])
      .then(([t, a]) => {
        setType(t);
        setAttempts(a);
      })
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }, [typeSlug, navigate]);

  const averageScore = attempts.length > 0
    ? Math.round(
        attempts.reduce((sum, a) => sum + (a.analysis?.overallScore ?? 0), 0) / attempts.length
      )
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  if (!type) {
    return <div className="text-center py-20 text-gray-500">Writing type not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{type.name}</h1>
        <p className="text-gray-600 mt-2">{type.description}</p>
      </div>

      {/* Expected structure */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Expected Structure</h2>
        <p className="text-gray-700 mt-2">{type.expectedStructure}</p>
      </div>

      {/* History summary */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Your History</h2>
        {attempts.length === 0 ? (
          <p className="text-gray-400 mt-2">No attempts yet for this text type.</p>
        ) : (
          <div className="mt-2 space-y-1">
            <p className="text-gray-700">
              <span className="font-medium">{attempts.length}</span> attempt{attempts.length !== 1 ? 's' : ''}
            </p>
            {averageScore !== null && (
              <p className="text-gray-700">
                Average score: <span className="font-semibold">{averageScore}/100</span>
              </p>
            )}
            <div className="mt-3 space-y-2">
              {attempts.slice(0, 5).map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/attempt/${a.id}`)}
                  className="flex items-center gap-2 text-sm text-brand-blue hover:underline"
                >
                  {new Date(a.finishedAt).toLocaleDateString()} — Score: {a.analysis?.overallScore ?? 'Pending'}
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Start button */}
      <Button
        size="lg"
        className="w-full"
        onClick={() => {
          const randomPrompt = type.prompts?.[Math.floor(Math.random() * (type.prompts?.length || 1))];
          if (randomPrompt) {
            navigate(`/practice/${type.slug}/start`, {
              state: { prompt: randomPrompt, type },
            });
          }
        }}
      >
        <Clock className="mr-2" size={20} />
        Start Timed Practice
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Add PracticeHome route to App.tsx**

```typescript
// Add import at top
import PracticeHome from './pages/PracticeHome';

// Add route inside <Routes>
<Route path="/practice/:typeSlug" element={<PracticeHome />} />
```

- [ ] **Step 3: Verify**

Run the app, click a text type in sidebar. Expected: PracticeHome page with description, expected structure, empty history, Start button

---

### Task 2.2: Timer component

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/components/Timer.tsx`

- [ ] **Step 1: Create Timer component**

```typescript
// frontend/src/components/Timer.tsx
import { useEffect, useRef, useCallback } from 'react';

interface TimerProps {
  timeLeft: number; // seconds remaining
  total: number;    // total seconds (30 min = 1800)
  onTick: () => void;
  onTimeUp: () => void;
  running: boolean;
}

export default function Timer({ timeLeft, total, onTick, onTimeUp, running }: TimerProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  const tick = useCallback(() => {
    onTick();
  }, [onTick]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, tick]);

  useEffect(() => {
    if (timeLeft <= 0 && running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      onTimeUpRef.current();
    }
  }, [timeLeft, running]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const percentage = (timeLeft / total) * 100;
  const isLow = timeLeft <= 60;
  const isMedium = timeLeft <= 300;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        {/* Circular progress */}
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
          <circle
            cx="64" cy="64" r="56"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="6"
          />
          <circle
            cx="64" cy="64" r="56"
            fill="none"
            stroke={isLow ? '#ef4444' : isMedium ? '#f2a71b' : '#2e9e5b'}
            strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 56}`}
            strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${isLow ? 'text-red-500' : isMedium ? 'text-brand-amber' : 'text-gray-700'}`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 2.3: TimedPractice page

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/pages/TimedPractice.tsx`
- Modify: `/Users/km/AI/projects/claude-proj/coach/frontend/src/App.tsx`

- [ ] **Step 1: Create TimedPractice page**

```typescript
// frontend/src/pages/TimedPractice.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import Timer from '@/components/Timer';

const TOTAL_TIME = 1800; // 30 minutes in seconds

export default function TimedPractice() {
  const location = useLocation();
  const navigate = useNavigate();
  const { typeSlug } = useParams<{ typeSlug: string }>();
  const { prompt, type } = location.state || {};

  const [text, setText] = useState('');
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [running, setRunning] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const startTimeRef = useRef(Date.now());
  const submittedRef = useRef(false);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const submitAttempt = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setRunning(false);
    setSubmitting(true);

    try {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      const attempt = await api.createAttempt({
        text,
        promptId: prompt?.id || 0,
        typeId: type?.id || 0,
        startedAt: new Date(startTimeRef.current).toISOString(),
        finishedAt: new Date().toISOString(),
        timeTaken: Math.min(elapsed, TOTAL_TIME - timeLeft),
        source: 'practice',
      });
      // Trigger AI analysis
      api.triggerAnalysis(attempt.id).catch(() => {});
      navigate(`/attempt/${attempt.id}`, { replace: true });
    } catch (err) {
      console.error('Failed to save attempt:', err);
      setSubmitting(false);
      submittedRef.current = false;
    }
  }, [text, prompt, type, timeLeft, navigate]);

  // Handle time up
  const handleTimeUp = useCallback(() => {
    submitAttempt();
  }, [submitAttempt]);

  // Handle tick
  const handleTick = useCallback(() => {
    setTimeLeft((t) => Math.max(0, t - 1));
  }, []);

  // Warn before unload if text entered
  useEffect(() => {
    if (text.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [text]);

  // Redirect if no prompt
  if (!prompt || !type) {
    navigate(`/practice/${typeSlug}`, { replace: true });
    return null;
  }

  if (submitting) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue mx-auto" />
          <p className="text-gray-500 mt-4">Saving your writing...</p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <p className="text-lg text-gray-700">Are you sure you want to submit?</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setConfirmed(false)}>Keep Writing</Button>
            <Button onClick={submitAttempt}>Submit Now</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Timer row */}
      <div className="flex items-center gap-6">
        <Timer
          timeLeft={timeLeft}
          total={TOTAL_TIME}
          onTick={handleTick}
          onTimeUp={handleTimeUp}
          running={running}
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Prompt</p>
          <p className="text-gray-800 mt-1">{prompt.text}</p>
          <p className="text-xs text-gray-400 mt-1">
            Type: {type.name} — Word count: {wordCount}
          </p>
        </div>
      </div>

      {/* Text area */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Start writing here..."
        className="w-full h-96 p-4 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-gray-800 leading-relaxed"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />

      {/* Bottom bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {wordCount} word{wordCount !== 1 ? 's' : ''}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            if (text.trim().length > 0) {
              setConfirmed(true);
            } else {
              submitAttempt();
            }
          }}
          disabled={submitting}
        >
          Submit Early
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add TimedPractice route to App.tsx**

```typescript
import TimedPractice from './pages/TimedPractice';
// Add route:
<Route path="/practice/:typeSlug/start" element={<TimedPractice />} />
```

- [ ] **Step 3: Create backend POST /api/attempts route**

Create `/Users/km/AI/projects/claude-proj/coach/backend/src/routes/attempts.ts`:
```typescript
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { typeId, promptId, text, startedAt, finishedAt, timeTaken, source, worksheetId } = req.body;

  if (!typeId || !promptId || !text || !startedAt || !finishedAt || timeTaken === undefined) {
    res.status(400).json({ error: 'Missing required fields', status: 400 });
    return;
  }

  const attempt = await prisma.attempt.create({
    data: {
      typeId,
      promptId,
      text,
      startedAt: new Date(startedAt),
      finishedAt: new Date(finishedAt),
      timeTaken,
      source: source || 'practice',
      worksheetId: worksheetId || null,
    },
  });

  res.status(201).json(attempt);
});

router.get('/', async (req: Request, res: Response) => {
  const { type } = req.query;
  const where = type
    ? { type: { slug: type as string } }
    : {};

  const attempts = await prisma.attempt.findMany({
    where,
    include: { analysis: true, type: true, prompt: true },
    orderBy: { finishedAt: 'desc' },
  });

  res.json(attempts);
});

router.get('/:id', async (req: Request, res: Response) => {
  const attempt = await prisma.attempt.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { analysis: true, type: true, prompt: true },
  });

  if (!attempt) {
    res.status(404).json({ error: 'Attempt not found', status: 404 });
    return;
  }

  res.json(attempt);
});

export default router;
```

- [ ] **Step 4: Register attempts route in index.ts**

Add to `backend/src/index.ts`:
```typescript
import attemptsRouter from './routes/attempts';
app.use('/api/attempts', attemptsRouter);
```

- [ ] **Step 5: Verify**

Run the app, click a text type, click Start Timed Practice. Expected: Writing screen with prompt, timer counting down, word count, textarea. Type some text, submit early. Expected: Submits, redirects to attempt detail.

---

## Phase 3 — Progress Tracking and Heatmap

### Task 3.1: GET /api/heatmap endpoint

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/src/routes/heatmap.ts`

- [ ] **Step 1: Create heatmap route**

```typescript
// backend/src/routes/heatmap.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const types = await prisma.writingType.findMany({
    include: {
      attempts: {
        where: { isDemo: false },
        include: { analysis: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const heatmap = types.map((type) => {
    const scoredAttempts = type.attempts.filter((a) => a.analysis?.overallScore != null);
    const averageScore =
      scoredAttempts.length > 0
        ? Math.round(
            scoredAttempts.reduce((sum, a) => sum + a.analysis!.overallScore, 0) /
              scoredAttempts.length
          )
        : null;

    return {
      typeId: type.id,
      typeName: type.name,
      typeSlug: type.slug,
      averageScore,
      attemptCount: type.attempts.length,
    };
  });

  res.json(heatmap);
});

export default router;
```

- [ ] **Step 2: Register heatmap route**

Add to `index.ts`: `app.use('/api/heatmap', heatmapRouter);`

- [ ] **Step 3: Test with curl**

Run the backend, then `curl http://localhost:3001/api/heatmap`
Expected: JSON array of 11 types, all with null scores (no attempts yet)

---

### Task 3.2: Heatmap component

**Files:**
- Remove: old dashboard placeholder in App.tsx (replace with real Dashboard page)
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/pages/Dashboard.tsx`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/components/Heatmap.tsx`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/hooks/useHeatmap.ts`

- [ ] **Step 1: Create useHeatmap hook**

```typescript
// frontend/src/hooks/useHeatmap.ts
import { useState, useEffect } from 'react';
import { api, HeatmapEntry } from '@/lib/api';

export function useHeatmap() {
  const [data, setData] = useState<HeatmapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getHeatmap()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const refresh = () => {
    setLoading(true);
    api.getHeatmap()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  return { data, loading, error, refresh };
}
```

- [ ] **Step 2: Create Heatmap component**

```typescript
// frontend/src/components/Heatmap.tsx
import { useNavigate } from 'react-router-dom';
import { HeatmapEntry } from '@/lib/api';

interface HeatmapProps {
  data: HeatmapEntry[];
  onSelect?: (slug: string) => void;
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'bg-gray-100 text-gray-400';
  if (score >= 80) return 'bg-green-600 text-white';
  if (score >= 60) return 'bg-green-400 text-white';
  if (score >= 40) return 'bg-yellow-400 text-gray-800';
  if (score >= 20) return 'bg-orange-400 text-white';
  return 'bg-red-500 text-white';
}

function getScoreLabel(score: number | null): string {
  if (score === null) return '—';
  return `${score}`;
}

export default function Heatmap({ data, onSelect }: HeatmapProps) {
  const navigate = useNavigate();

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading heatmap data...</p>
      </div>
    );
  }

  const allEmpty = data.every((d) => d.attemptCount === 0);

  if (allEmpty) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="bg-white rounded-2xl p-12 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-700">Your progress will appear here</h2>
          <p className="text-gray-500 mt-3 max-w-md mx-auto">
            Start a timed practice for any text type to see your performance heatmap grow.
            Each text type gets a cell shaded by your average score.
          </p>
          <div className="flex justify-center gap-2 mt-8">
            {data.slice(0, 5).map((d) => (
              <button
                key={d.typeSlug}
                onClick={() => navigate(`/practice/${d.typeSlug}`)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:border-brand-blue hover:text-brand-blue transition-colors"
              >
                {d.typeName}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">Click a text type above to start practising</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {data.map((entry) => (
        <button
          key={entry.typeSlug}
          onClick={() => (onSelect || navigate)(entry.typeSlug)}
          className={`rounded-xl p-4 text-left transition-all hover:scale-105 active:scale-95 ${getScoreColor(entry.averageScore)}`}
          title={`${entry.typeName}: ${entry.attemptCount} attempt${entry.attemptCount !== 1 ? 's' : ''}`}
        >
          <div className="text-sm font-medium">{entry.typeName}</div>
          <div className="text-2xl font-bold mt-1">{getScoreLabel(entry.averageScore)}</div>
          <div className="text-xs mt-1 opacity-70">
            {entry.attemptCount} attempt{entry.attemptCount !== 1 ? 's' : ''}
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create Dashboard page**

```typescript
// frontend/src/pages/Dashboard.tsx
import { useNavigate } from 'react-router-dom';
import { useHeatmap } from '@/hooks/useHeatmap';
import Heatmap from '@/components/Heatmap';
import { BarChart3 } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, loading, error } = useHeatmap();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500">Failed to load data: {error}</p>
      </div>
    );
  }

  const handleSelect = (slug: string) => {
    navigate(`/practice/${slug}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 size={24} className="text-brand-blue" />
        <h1 className="text-2xl font-bold text-gray-900">Progress Dashboard</h1>
      </div>

      <p className="text-gray-500">
        Your performance across all text types. Click any cell to see your score history for that type.
      </p>

      <Heatmap data={data} onSelect={handleSelect} />

      {data.some((d) => d.attemptCount > 0) && (
        <div className="flex items-center gap-4 text-sm text-gray-500 justify-center">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500 inline-block" />
            <span>0-19</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-orange-400 inline-block" />
            <span>20-39</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-400 inline-block" />
            <span>40-59</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-400 inline-block" />
            <span>60-79</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-600 inline-block" />
            <span>80-100</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update App.tsx to use Dashboard page**

```typescript
import Dashboard from './pages/Dashboard';
// Replace the dashboard placeholder route with:
<Route path="/dashboard" element={<Dashboard />} />
```

---

### Task 3.3: Score history drill-down

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/components/ScoreHistory.tsx`

- [ ] **Step 1: Create ScoreHistory component**

```typescript
// frontend/src/components/ScoreHistory.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Attempt } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ScoreHistory() {
  const { typeSlug } = useParams<{ typeSlug: string }>();
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeName, setTypeName] = useState('');

  useEffect(() => {
    if (!typeSlug) return;
    Promise.all([
      api.getAttempts(typeSlug),
      api.getType(typeSlug),
    ])
      .then(([atts, t]) => {
        setAttempts(atts.filter((a) => a.analysis));
        setTypeName(t.name);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [typeSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  const chartData = [...attempts]
    .reverse()
    .map((a) => ({
      date: new Date(a.finishedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
      score: a.analysis?.overallScore ?? 0,
      id: a.id,
    }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">{typeName} — Score History</h1>
      </div>

      {chartData.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No completed attempts with scores yet for this text type.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#1c6dd0"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#1c6dd0', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#1c6dd0' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {attempts.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/attempt/${a.id}`)}
                className="w-full bg-white rounded-lg p-4 border border-gray-200 text-left hover:border-brand-blue/50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {new Date(a.finishedAt).toLocaleDateString('en-AU', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="font-semibold text-brand-blue">
                    Score: {a.analysis?.overallScore ?? 'Pending'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-1">{a.text.slice(0, 100)}...</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add ScoreHistory route to App.tsx**

```typescript
import ScoreHistory from './components/ScoreHistory';
<Route path="/history/:typeSlug" element={<ScoreHistory />} />
```

- [ ] **Step 3: Update Heatmap navigation to go to history**

When clicking a heatmap cell that has attempts, navigate to `/history/:typeSlug` instead of `/practice/:typeSlug`.

---

## Phase 4 — AI Analysis

### Task 4.1: AI service (OpenRouter integration)

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/src/services/ai.service.ts`

- [ ] **Step 1: Create AI service**

```typescript
// backend/src/services/ai.service.ts
import prisma from '../lib/prisma';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openrouter/free';

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface AnalysisResult {
  vocabScore: number;
  vocabComments: string;
  structureScore: number;
  structureComments: string;
  contentScore: number;
  contentComments: string;
  overallScore: number;
  summary: string;
}

function parseAnalysisResponse(content: string): AnalysisResult {
  try {
    // Try to find JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fall through to fallback
  }
  // Fallback if parsing fails
  return {
    vocabScore: 50,
    vocabComments: 'Analysis could not be parsed. Please try again.',
    structureScore: 50,
    structureComments: 'Analysis could not be parsed. Please try again.',
    contentScore: 50,
    contentComments: 'Analysis could not be parsed. Please try again.',
    overallScore: 50,
    summary: 'Analysis could not be completed.',
  };
}

export async function analyzeAttempt(attemptId: number): Promise<AnalysisResult> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { type: true, prompt: true },
  });

  if (!attempt) {
    throw new Error('Attempt not found');
  }

  const prompt = `You are an expert writing tutor for the NSW Selective High School Placement Test. 
Analyse the following student's writing piece and provide scores and feedback.

Text Type: ${attempt.type.name}
Expected Structure: ${attempt.type.expectedStructure}
Prompt: ${attempt.prompt.text}

Student's Writing:
---
${attempt.text}
---

Respond with ONLY a JSON object (no markdown, no code fences) in this exact format:
{
  "vocabScore": <0-100>,
  "vocabComments": "<specific feedback about vocabulary, referencing the student's actual word choices>",
  "structureScore": <0-100>,
  "structureComments": "<specific feedback about structure and flow, referencing the student's actual structure>",
  "contentScore": <0-100>,
  "contentComments": "<specific feedback about content and how well it follows the expected structure, referencing the student's actual content>",
  "overallScore": <0-100>,
  "summary": "<2-3 sentence summary of the overall performance>"
}

All comments must reference specific parts of the student's text.`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('No OPENROUTER_API_KEY set, using fallback analysis');
    return getFallbackAnalysis();
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'NSW Selective Writing Coach',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API error (${response.status}):`, errorText);
      return getFallbackAnalysis();
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content || '';
    return parseAnalysisResponse(content);
  } catch (error) {
    console.error('OpenRouter API call failed:', error);
    return getFallbackAnalysis();
  }
}

function getFallbackAnalysis(): AnalysisResult {
  return {
    vocabScore: 0,
    vocabComments: 'Unable to analyse vocabulary. Please check your OpenRouter API key and try again.',
    structureScore: 0,
    structureComments: 'Unable to analyse structure. Please check your OpenRouter API key and try again.',
    contentScore: 0,
    contentComments: 'Unable to analyse content. Please check your OpenRouter API key and try again.',
    overallScore: 0,
    summary: 'Analysis could not be completed. Please ensure your API key is configured correctly in the .env file.',
  };
}

export async function generateWorksheetPrompts(typeIds: number[]): Promise<string[]> {
  const types = await prisma.writingType.findMany({
    where: { id: { in: typeIds } },
  });

  const typeDescriptions = types
    .map((t) => `${t.name}: ${t.expectedStructure}`)
    .join('\n');

  const prompt = `You are a writing tutor creating practice worksheets for a student preparing for the NSW Selective High School Placement Test.
The student needs practice with the following text type(s):

${typeDescriptions}

Generate 3 writing prompts that target these text types. Each prompt should be a complete, engaging topic suitable for a Year 6 student.
Respond with ONLY a JSON array of strings, no markdown, no code fences:
["prompt 1", "prompt 2", "prompt 3"]`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return [
      'Write a persuasive text arguing for or against school uniforms.',
      'Write a narrative about a surprising discovery.',
      'Write a discussion on whether homework should be banned.',
    ];
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'NSW Selective Writing Coach',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      return getFallbackPrompts();
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content || '';
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
    return getFallbackPrompts();
  } catch {
    return getFallbackPrompts();
  }
}

function getFallbackPrompts(): string[] {
  return [
    'Write a persuasive text arguing for or against school uniforms.',
    'Write a narrative about a surprising discovery.',
    'Write a discussion on whether homework should be banned.',
  ];
}
```

---

### Task 4.2: POST /api/analysis route

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/src/routes/analysis.ts`

- [ ] **Step 1: Create analysis route**

```typescript
// backend/src/routes/analysis.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { analyzeAttempt } from '../services/ai.service';

const router = Router();

router.post('/:attemptId', async (req: Request, res: Response) => {
  const attemptId = parseInt(req.params.attemptId);

  try {
    // Check if analysis already exists
    const existing = await prisma.analysis.findUnique({ where: { attemptId } });
    if (existing) {
      res.json(existing);
      return;
    }

    const result = await analyzeAttempt(attemptId);

    const analysis = await prisma.analysis.create({
      data: {
        attemptId,
        ...result,
      },
    });

    res.json(analysis);
  } catch (error) {
    console.error('Analysis failed:', error);
    res.status(500).json({ error: 'Analysis failed', status: 500 });
  }
});

export default router;
```

- [ ] **Step 2: Register analysis route**

Add to `index.ts`:
```typescript
import analysisRouter from './routes/analysis';
app.use('/api/analysis', analysisRouter);
```

- [ ] **Step 3: Test analysis**

Submit an attempt via the UI, then check the console for the analysis result. Or test with curl:
```bash
curl -X POST http://localhost:3001/api/analysis/1
```
Expected: Returns analysis JSON object

---

### Task 4.3: AttemptDetail page

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/pages/AttemptDetail.tsx`
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/components/AnalysisDisplay.tsx`

- [ ] **Step 1: Create AnalysisDisplay component**

```typescript
// frontend/src/components/AnalysisDisplay.tsx
import { Analysis } from '@/lib/api';

interface AnalysisDisplayProps {
  analysis: Analysis;
}

function ScoreBar({ label, score, comments }: { label: string; score: number; comments: string }) {
  const color =
    score >= 80 ? 'bg-green-500' :
    score >= 60 ? 'bg-brand-green' :
    score >= 40 ? 'bg-brand-amber' :
    'bg-red-500';

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-lg font-bold" style={{ color: score >= 40 ? undefined : '#ef4444' }}>
          {score}/100
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">{comments}</p>
    </div>
  );
}

export default function AnalysisDisplay({ analysis }: AnalysisDisplayProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Score</h2>
        <div className="flex items-center gap-4">
          <span className="text-5xl font-bold text-brand-blue">{analysis.overallScore}</span>
          <span className="text-gray-500">/ 100</span>
        </div>
        <p className="text-gray-600 mt-4 leading-relaxed">{analysis.summary}</p>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Detailed Breakdown</h2>
        <ScoreBar label="Vocabulary" score={analysis.vocabScore} comments={analysis.vocabComments} />
        <hr className="border-gray-100" />
        <ScoreBar label="Sentence Structure & Flow" score={analysis.structureScore} comments={analysis.structureComments} />
        <hr className="border-gray-100" />
        <ScoreBar label="Content & Structure" score={analysis.contentScore} comments={analysis.contentComments} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AttemptDetail page**

```typescript
// frontend/src/pages/AttemptDetail.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Attempt } from '@/lib/api';
import { ArrowLeft, Clock, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AnalysisDisplay from '@/components/AnalysisDisplay';

export default function AttemptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    // Poll for analysis if it doesn't exist yet
    let pollCount = 0;
    const fetchAttempt = async () => {
      try {
        const a = await api.getAttempt(parseInt(id));
        setAttempt(a);
        // If no analysis, trigger one and poll
        if (!a.analysis) {
          api.triggerAnalysis(parseInt(id)).catch(() => {});
          if (pollCount < 30) {
            pollCount++;
            setTimeout(fetchAttempt, 2000);
            return;
          }
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAttempt();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-brand-blue mx-auto" />
          <p className="text-gray-500 mt-4">Analysing your writing...</p>
          <p className="text-xs text-gray-400 mt-2">This usually takes a few seconds</p>
        </div>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500">{error || 'Attempt not found'}</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const timeMinutes = Math.floor(attempt.timeTaken / 60);
  const timeSeconds = attempt.timeTaken % 60;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attempt Detail</h1>
          <p className="text-sm text-gray-500">
            {new Date(attempt.finishedAt).toLocaleDateString('en-AU', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-1.5">
          <Clock size={14} />
          <span>{timeMinutes}m {timeSeconds}s</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText size={14} />
          <span>{attempt.text.trim().split(/\s+/).length} words</span>
        </div>
        <span className="capitalize">{attempt.source}</span>
      </div>

      {/* Student's writing */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Writing</h2>
        <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">{attempt.text}</div>
      </div>

      {/* Analysis (if available) */}
      {attempt.analysis ? (
        <AnalysisDisplay analysis={attempt.analysis} />
      ) : (
        <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
          <Loader2 size={24} className="animate-spin text-brand-blue mx-auto" />
          <p className="text-gray-500 mt-2">Analysis still processing...</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add AttemptDetail route to App.tsx**

```typescript
import AttemptDetail from './pages/AttemptDetail';
<Route path="/attempt/:id" element={<AttemptDetail />} />
```

---

## Phase 5 — Admin, Worksheets, and Demo Data

### Task 5.1: Admin page with toggle

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/frontend/src/pages/Admin.tsx`

- [ ] **Step 1: Create Admin page**

```typescript
// frontend/src/pages/Admin.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHeatmap } from '@/hooks/useHeatmap';
import Heatmap from '@/components/Heatmap';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Shield, Plus, Database, Trash2 } from 'lucide-react';

export default function Admin() {
  const navigate = useNavigate();
  const { data: heatmapData, refresh: refreshHeatmap } = useHeatmap();
  const [generating, setGenerating] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleGenerateWorksheet = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      // Find weakest types (lowest scores)
      const withScores = heatmapData
        .filter((d) => d.averageScore !== null)
        .sort((a, b) => (a.averageScore || 0) - (b.averageScore || 0));

      const targetTypes = withScores.length > 0
        ? [withScores[0].typeId]
        : heatmapData.slice(0, 2).map((d) => d.typeId);

      const worksheet = await api.generateWorksheet(targetTypes);
      setMessage(`Worksheet "${worksheet.title}" generated! Check the worksheets list below.`);
      refreshHeatmap();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    setMessage(null);
    try {
      const result = await api.loadDemo();
      setMessage(result.message);
      refreshHeatmap();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleClearDemo = async () => {
    setDemoLoading(true);
    setMessage(null);
    try {
      const result = await api.clearDemo();
      setMessage(result.message);
      refreshHeatmap();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Shield size={24} className="text-brand-amber" />
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      </div>

      {/* Message */}
      {message && (
        <div className="bg-brand-amber/10 border border-brand-amber/30 rounded-xl p-4 text-sm text-gray-700">
          {message}
        </div>
      )}

      {/* Heatmap section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Student Performance</h2>
        <Heatmap data={heatmapData} onSelect={(slug) => navigate(`/history/${slug}`)} />
      </div>

      {/* Worksheet generation */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Generate Worksheet</h2>
        <p className="text-sm text-gray-500 mb-4">
          Generate an AI-assisted worksheet targeting the weakest text types from the heatmap above.
        </p>
        <Button onClick={handleGenerateWorksheet} disabled={generating}>
          <Plus className="mr-2" size={18} />
          {generating ? 'Generating...' : 'Generate Worksheet'}
        </Button>
      </div>

      {/* Demo data controls */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Demo Data</h2>
        <p className="text-sm text-gray-500 mb-4">
          Load demo data to populate the app with sample attempts, analyses, and worksheets for demonstration purposes.
          Clear demo data removes only the seeded records, leaving any real student work untouched.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleLoadDemo} disabled={demoLoading}>
            <Database className="mr-2" size={18} />
            {demoLoading ? 'Loading...' : 'Load Demo Data'}
          </Button>
          <Button variant="outline" onClick={handleClearDemo} disabled={demoLoading}>
            <Trash2 className="mr-2" size={18} />
            {demoLoading ? 'Clearing...' : 'Clear Demo Data'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add Admin route to App.tsx**

```typescript
import Admin from './pages/Admin';
<Route path="/admin" element={<Admin />} />
```

---

### Task 5.2: Worksheet generation backend

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/src/routes/worksheets.ts`

- [ ] **Step 1: Create worksheets route**

```typescript
// backend/src/routes/worksheets.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { generateWorksheetPrompts } from '../services/ai.service';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  const { typeIds } = req.body;

  if (!typeIds || !Array.isArray(typeIds) || typeIds.length === 0) {
    res.status(400).json({ error: 'typeIds array is required', status: 400 });
    return;
  }

  try {
    const prompts = await generateWorksheetPrompts(typeIds);
    const types = await prisma.writingType.findMany({
      where: { id: { in: typeIds } },
    });

    const title = `Worksheet: ${types.map((t) => t.name).join(' + ')}`;

    const worksheet = await prisma.worksheet.create({
      data: {
        title,
        typeId: typeIds[0],
        prompts: JSON.stringify(prompts),
      },
    });

    res.status(201).json(worksheet);
  } catch (error) {
    console.error('Worksheet generation failed:', error);
    res.status(500).json({ error: 'Failed to generate worksheet', status: 500 });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  const worksheets = await prisma.worksheet.findMany({
    orderBy: { createdAt: 'desc' },
    include: { attempts: { include: { analysis: true } } },
  });
  res.json(worksheets);
});

export default router;
```

- [ ] **Step 2: Register worksheets route**

```typescript
import worksheetsRouter from './routes/worksheets';
app.use('/api/worksheets', worksheetsRouter);
```

---

### Task 5.3: Demo data load/clear

**Files:**
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/src/services/demo.service.ts`
- Create: `/Users/km/AI/projects/claude-proj/coach/backend/src/routes/demo.ts`

- [ ] **Step 1: Create demo service**

```typescript
// backend/src/services/demo.service.ts
import prisma from '../lib/prisma';

const DEMO_ANALYSES = [
  { vocabScore: 72, vocabComments: 'Good use of descriptive adjectives and varied vocabulary. Words like "remarkable" and "extraordinary" show strong word choice. Could incorporate more subject-specific terminology.', structureScore: 65, structureComments: 'Sentences are mostly well-structured but some run-on sentences affect flow. Varying sentence openings would improve rhythm.', contentScore: 70, contentComments: 'Clear introduction and conclusion. The body paragraphs follow the expected structure well. Some points could be developed further with more specific examples.', overallScore: 69, summary: 'A solid attempt showing good understanding of the text type. Vocabulary is a strength, while sentence structure offers room for improvement. Keep practising to build consistency.' },
  { vocabScore: 45, vocabComments: 'Basic vocabulary with limited variety. Many repeated words and simple adjectives. Try using a thesaurus to find more precise words.', structureScore: 50, structureComments: 'Simple sentence structures throughout. Most sentences follow a subject-verb-object pattern. Try incorporating compound and complex sentences.', contentScore: 55, contentComments: 'The main ideas are present but could be better organised. The expected structure is partially followed. More detailed examples would strengthen the response.', overallScore: 50, summary: 'A developing attempt with room for growth. Focus on expanding vocabulary and varying sentence structures. The content addresses the prompt but needs more depth.' },
  { vocabScore: 88, vocabComments: 'Impressive vocabulary with sophisticated word choices. Excellent use of figurative language and vivid descriptions. The writing demonstrates a strong command of language.', structureScore: 85, structureComments: 'Excellent sentence variety with a natural flow. Complex sentences are used effectively. Transitions between ideas are smooth and logical.', contentScore: 90, contentComments: 'Outstanding structure that perfectly matches the expected format. Each paragraph serves a clear purpose. Strong, specific examples support every point.', overallScore: 88, summary: 'An excellent piece demonstrating strong writing skills across all areas. The vocabulary and content are particularly impressive. This level of writing would score highly in the Selective Test.' },
  { vocabScore: 60, vocabComments: 'Adequate vocabulary with some good word choices. Could benefit from more descriptive language and stronger verbs. Some words are used repetitively.', structureScore: 58, structureComments: 'Sentence structures are mostly correct but lack variety. Some sentences feel choppy when read aloud. Working on sentence flow would improve the overall quality.', contentScore: 62, contentComments: 'The response addresses the prompt and follows the expected structure reasonably well. Ideas are clear but could be more developed. More specific examples would strengthen the argument.', overallScore: 60, summary: 'A competent attempt that meets basic requirements. The writing shows understanding of the text type but would benefit from more sophisticated language and smoother sentence flow.' },
  { vocabScore: 35, vocabComments: 'Very basic vocabulary with frequent repetition. Simple words are overused (good, nice, big, said). Building vocabulary should be a priority.', structureScore: 40, structureComments: 'Mostly simple sentences with limited variation. There are some grammatical errors that affect clarity. Practising different sentence types would help.', contentScore: 38, contentComments: 'The response is brief and does not fully develop the ideas needed. The expected structure is partially followed but key elements are missing. More practice with planning before writing is recommended.', overallScore: 38, summary: 'This attempt shows the writer is still developing fundamental skills. Focus on building vocabulary, learning different sentence structures, and understanding the expected format for each text type.' },
  { vocabScore: 78, vocabComments: 'Strong vocabulary with good use of domain-specific language. Words are well-chosen and precise. The writing demonstrates a developing personal style.', structureScore: 72, structureComments: 'Good sentence variety with effective use of compound and complex sentences. Some transitions could be smoother. The overall flow is solid.', contentScore: 75, contentComments: 'Well-structured response that follows the expected format. Arguments are supported with relevant examples. The conclusion effectively summarises the main points.', overallScore: 75, summary: 'A strong attempt that shows good understanding of the text type. The vocabulary and content work well together. Continued practice will help build consistency and confidence.' },
  { vocabScore: 82, vocabComments: 'Excellent vocabulary with sophisticated word choices. The writing uses vivid imagery and precise language effectively. A strong command of vocabulary is evident.', structureScore: 78, structureComments: 'Very good sentence variety with effective rhythm and flow. Complex structures are used naturally. Minor improvements in transitions would elevate the writing further.', contentScore: 80, contentComments: 'Well-developed response that fully addresses the prompt. The structure closely matches the expected format. Strong evidence and examples support the main ideas.', overallScore: 80, summary: 'A very good attempt demonstrating strong writing skills. The vocabulary use is particularly effective. With continued attention to sentence structure, this writer could achieve excellent results.' },
  { vocabScore: 55, vocabComments: 'Mixed vocabulary with some effective word choices alongside simpler language. The writer occasionally finds the right word but often settles for simpler alternatives.', structureScore: 52, structureComments: 'A mix of simple and compound sentences. Some sentences are well-constructed while others could be improved. Overall readability is good.', contentScore: 58, contentComments: 'The response covers the main points but lacks depth in development. The structure is partially followed. Adding more specific details would strengthen the response.', overallScore: 55, summary: 'A developing attempt that shows potential. The writer understands the basics but needs to work on vocabulary depth, sentence variety, and content development to reach the next level.' },
  { vocabScore: 68, vocabComments: 'Good vocabulary with some effective word choices. The writer uses descriptive language appropriately. A wider range of vocabulary would strengthen the writing.', structureScore: 70, structureComments: 'Solid sentence structure with good variety. Most sentences are well-constructed. The writing has a natural flow with some effective transitions.', contentScore: 72, contentComments: 'Well-organised response that follows the expected structure. Ideas are clear and mostly well-developed. The conclusion effectively wraps up the main points.', overallScore: 70, summary: 'A good attempt showing solid writing skills across all areas. The structure and content are particular strengths. Continued vocabulary development will help this writer excel.' },
  { vocabScore: 92, vocabComments: 'Outstanding vocabulary that demonstrates sophisticated language skills. The writing is rich with precise, vivid, and varied word choices. This is a clear strength.', structureScore: 90, structureComments: 'Exceptional sentence variety with flawless flow. Complex and compound sentences are used masterfully. The writing has a natural, engaging rhythm throughout.', contentScore: 88, contentComments: 'Exemplary structure that perfectly matches the text type. Every paragraph serves a clear purpose and flows logically to the next. Arguments are well-supported with specific, compelling evidence.', overallScore: 90, summary: 'An outstanding piece of writing that demonstrates excellence across all criteria. This is the standard of writing that would achieve top marks in the Selective Test. Continue to challenge yourself with increasingly complex topics.' },
  { vocabScore: 42, vocabComments: 'Limited vocabulary with many commonly used words. The writing would benefit from more descriptive language and precise word choices. Consider using a dictionary to expand word knowledge.', structureScore: 45, structureComments: 'Simple sentence structures with limited variation. Some sentences are incomplete or run-on. Practising different sentence types and proofreading would help.', contentScore: 48, contentComments: 'The response addresses the prompt but lacks detail and organisation. The expected structure is partially followed but key elements are underdeveloped. Planning before writing would help organise ideas more effectively.', overallScore: 45, summary: 'This attempt shows the writer is still developing their skills. Focus on vocabulary building, sentence structure variety, and organising content according to the expected format.' },
  { vocabScore: 75, vocabComments: 'Good vocabulary with several effective word choices. The writer uses descriptive language well. Continued expansion of vocabulary will strengthen future responses.', structureScore: 68, structureComments: 'Good variety in sentence structures. Some sentences are very effective while others feel more basic. Working on transitions between ideas would improve flow.', contentScore: 73, contentComments: 'Well-structured response that follows the expected format. Ideas are developed with relevant examples. The response could benefit from deeper analysis in some sections.', overallScore: 72, summary: 'A solid attempt showing good writing skills. The vocabulary and content are strengths. Focus on sentence structure and transitions to elevate the overall quality.' },
  { vocabScore: 58, vocabComments: 'Adequate vocabulary with some attempts at more sophisticated words. The writer is clearly trying to expand their vocabulary but not all attempts are successful. Keep reading widely to build word knowledge.', structureScore: 55, structureComments: 'Reasonable sentence variety but inconsistent. Some sections flow well while others feel disjointed. Practicing connecting ideas between sentences would help.', contentScore: 60, contentComments: 'The response covers the main requirements of the text type. The structure is followed but could be more consistently applied. Adding more specific examples would strengthen the response.', overallScore: 58, summary: 'A developing attempt with some strengths. The writer shows understanding of the text type and attempts good vocabulary. Continued practice and wider reading will help build skills.' },
  { vocabScore: 85, vocabComments: 'Very strong vocabulary with sophisticated word choices used naturally. The writing demonstrates a wide-ranging vocabulary that is used precisely and effectively.', structureScore: 82, structureComments: 'Excellent sentence variety with effective use of different structures. The writing flows well with smooth transitions between ideas.', contentScore: 84, contentComments: 'Well-developed response that fully addresses the prompt. The structure closely follows the expected format with strong evidence and analysis throughout.', overallScore: 84, summary: 'A very strong attempt demonstrating confident writing skills. The vocabulary and content are particularly effective. This writer is well-prepared for the Selective Test.' },
  { vocabScore: 48, vocabComments: 'Basic vocabulary that could be significantly expanded. Many words are repeated unnecessarily. Reading widely and keeping a vocabulary journal would be beneficial.', structureScore: 42, structureComments: 'Limited sentence variety with some grammatical errors. Many sentences follow the same pattern which makes the writing feel repetitive. Varying sentence openings would help.', contentScore: 45, contentComments: 'The response addresses the prompt but is brief and lacks development. The expected structure is partially followed. More detailed planning before writing is recommended.', overallScore: 45, summary: 'This attempt indicates the writer is still building foundational writing skills. Prioritise vocabulary development, sentence structure practice, and understanding text type expectations.' },
];

async function getDemoType(typeName: string) {
  return prisma.writingType.findUnique({ where: { slug: typeName } });
}

async function getDemoPrompt(typeId: number) {
  const prompts = await prisma.prompt.findMany({
    where: { typeId },
    take: 1,
  });
  return prompts[0];
}

export async function loadDemoData() {
  // Check if demo data already exists
  const existingDemo = await prisma.attempt.findFirst({ where: { isDemo: true } });
  if (existingDemo) {
    return { message: 'Demo data already loaded. Clear it first if you want to reload.' };
  }

  const typeSlugs = [
    'persuasive', 'narrative-creative', 'discussion', 'letter', 'speech',
    'news-report', 'review', 'diary-entry', 'advertisement', 'guide', 'advice-sheet',
  ];

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  let attemptCount = 0;

  for (let i = 0; i < typeSlugs.length; i++) {
    const type = await getDemoType(typeSlugs[i]);
    if (!type) continue;

    const prompt = await getDemoPrompt(type.id);
    if (!prompt) continue;

    // Create 1-2 attempts per type
    for (let j = 0; j < 2; j++) {
      const daysAgo = Math.floor(Math.random() * 28) + 1;
      const startedAt = new Date(now - daysAgo * DAY - 1800 * 1000);
      const finishedAt = new Date(startedAt.getTime() + (Math.floor(Math.random() * 1500) + 300) * 1000);
      const timeTaken = Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000);

      const analysisIndex = (i * 2 + j) % DEMO_ANALYSES.length;
      const analysis = DEMO_ANALYSES[analysisIndex];

      const attempt = await prisma.attempt.create({
        data: {
          typeId: type.id,
          promptId: prompt.id,
          text: getSampleText(typeSlugs[i]),
          startedAt,
          finishedAt,
          timeTaken,
          source: 'practice',
          isDemo: true,
          analysis: {
            create: {
              ...analysis,
              isDemo: true,
            },
          },
        },
      });

      attemptCount++;
    }
  }

  // Create a demo worksheet with one attempt
  const demoType = await getDemoType('persuasive');
  if (demoType) {
    const demoPrompt = await getDemoPrompt(demoType.id);
    const worksheet = await prisma.worksheet.create({
      data: {
        title: 'Worksheet: Persuasive + Discussion',
        typeId: demoType.id,
        prompts: JSON.stringify([
          'Argue whether schools should have a four-day week.',
          'Discuss the pros and cons of homework.',
          'Write a persuasive letter to your local council about a community issue.',
        ]),
        isDemo: true,
      },
    });

    if (demoPrompt) {
      const wsStartedAt = new Date(now - 2 * DAY - 1800 * 1000);
      const wsFinishedAt = new Date(wsStartedAt.getTime() + 1200 * 1000);

      await prisma.attempt.create({
        data: {
          typeId: demoType.id,
          promptId: demoPrompt.id,
          text: 'I believe that schools should have a four-day week because it would give students more time to rest and pursue other interests. Many students feel tired after five days of school and having an extra day off would help them recharge. Additionally, families could spend more quality time together on the long weekend. However, some people argue that less school time means less learning. But I think students would actually learn better if they were more rested and focused during the four days they are at school. In conclusion, a four-day school week would benefit students, families, and even teachers by creating a better balance between school and life.',
          startedAt: wsStartedAt,
          finishedAt: wsFinishedAt,
          timeTaken: 1200,
          source: 'worksheet',
          worksheetId: worksheet.id,
          isDemo: true,
          analysis: {
            create: {
              vocabScore: 68,
              vocabComments: 'Good use of persuasive language with words like "benefit" and "recharge". The writing uses effective transition words like "additionally" and "however". Could incorporate more sophisticated vocabulary.',
              structureScore: 72,
              structureComments: 'Well-structured sentences with good variety. The argument flows logically from point to point. Some sentences could be more concise for greater impact.',
              contentScore: 75,
              contentComments: 'Clear thesis statement with well-supported arguments. The counter-argument is addressed effectively. The conclusion summarises the main points well. A strong persuasive structure is followed.',
              overallScore: 72,
              summary: 'A solid persuasive piece that demonstrates good understanding of the text type. The structure and argument development are strengths. Continued vocabulary development will help elevate future responses.',
              isDemo: true,
            },
          },
        },
      });

      attemptCount++;
    }
  }

  return { message: `Demo data loaded: ${attemptCount} attempts created across ${typeSlugs.length} text types.` };
}

export async function clearDemoData() {
  // Delete demo analyses, attempts, worksheets, in order
  await prisma.analysis.deleteMany({ where: { isDemo: true } });
  await prisma.attempt.deleteMany({ where: { isDemo: true } });
  await prisma.worksheet.deleteMany({ where: { isDemo: true } });

  return { message: 'Demo data cleared successfully. Your real attempts have not been touched.' };
}

function getSampleText(type: string): string {
  const texts: Record<string, string> = {
    persuasive: 'I strongly believe that every school should have a student-run newspaper. Firstly, it would give students a creative outlet to express their ideas and opinions. Secondly, it would teach valuable skills like writing, editing, and teamwork. Finally, it would bring the school community together by sharing news and stories. Some might say it would be too much work, but the benefits far outweigh the challenges. A student newspaper would create a stronger, more connected school community.',
    'narrative-creative': 'The moment I opened the door, I knew nothing would ever be the same again. The room was not how I had left it. Books were scattered across the floor, and the window was wide open, curtains billowing in the wind. But strangest of all was the map lying on my desk. It was old and yellowed, with markings I had never seen before. My hands trembled as I picked it up. Little did I know that this discovery would lead me on the greatest adventure of my life.',
    discussion: 'The question of whether homework should be banned in primary schools is a complex one. On one hand, homework reinforces what students learn in class and teaches responsibility. Many parents believe it helps their children develop good study habits. On the other hand, children need time to play, rest, and spend time with family. Some studies show that excessive homework causes stress and burnout in young students. In my opinion, a balanced approach would be best, with limited but meaningful homework assigned.',
    letter: 'Dear Principal, I am writing to express my strong support for building a new outdoor play area at our school. As a student who has been here for three years, I have seen how crowded our current playground gets during lunch breaks. A new play area would give students more space to be active and would help reduce arguments over equipment. It would also show that our school values student wellbeing. I would be happy to help with fundraising efforts. Yours sincerely, A Student.',
    speech: 'Good morning teachers and fellow students. Today I want to talk about why kindness is the most important quality a leader can have. A leader who is kind listens to others, understands their struggles, and works to help everyone succeed. Kindness is not weakness, it is strength. It takes courage to be kind when things get difficult. As the famous saying goes, "A leader is one who knows the way, goes the way, and shows the way." And the best way to lead is with kindness.',
    'news-report': 'SYDNEY: A local community has banded together to save a historic building from demolition. The old library, which has stood in the town centre for over 120 years, was scheduled to be knocked down next month. However, residents formed a protest group and collected over 5,000 signatures on a petition. "This building is part of our history," said Mrs Sarah Thompson, a local resident. The council has agreed to reconsider its decision. A meeting will be held next week to discuss alternative plans.',
    review: 'I recently read "The Lost Adventures" by Jessica Moore, and I was thoroughly impressed. The story follows three friends who discover a hidden world beneath their school. The characters are well-developed and relatable, each with their own unique personality. The plot moves at a good pace, with plenty of twists to keep readers engaged. The author\'s descriptive writing makes the hidden world come alive. I would give this book five out of five stars and recommend it to anyone who loves adventure stories.',
    'diary-entry': 'Dear Diary, Today was the most amazing day! I discovered that I can sing. It happened during music class when Mrs Chen asked me to try a solo part. I was so nervous, but when I opened my mouth, the notes came out clear and beautiful. Everyone clapped, and I felt a warmth spread through my chest. I can\'t believe I\'ve been hiding this voice inside me all these years. I signed up for the school choir immediately. I can\'t wait for tomorrow\'s practice!',
    advertisement: 'Introducing the AquaPure Water Bottle. The bottle that filters water as you drink! Made from sustainable materials, our bottle removes 99.9% of impurities while keeping your drink cold for 24 hours. Perfect for school, sports, or travel. Features include a built-in filter indicator, leak-proof design, and a comfortable grip. Join thousands of satisfied customers and help reduce plastic waste. Order now and get 20% off your first purchase. AquaPure. Drink better. Live better.',
    guide: 'Welcome to Sydney\'s public transport system. This guide will help you navigate like a local. First, get an Opal card from any convenience store or train station. Tap on when you board and tap off when you leave. Trains run frequently between major stations from 5am to midnight. Buses cover areas that trains don\'t reach. Ferries are a beautiful way to travel across the harbour. Remember to check the Transport NSW app for real-time updates and service changes. Always stand behind the yellow line on platforms and give up your seat for elderly passengers.',
    'advice-sheet': 'Starting at a new school can be nerve-wracking, but these tips will help you settle in. Tip 1: Smile and say hello to people. A simple greeting can start a conversation. Tip 2: Join a club or sport. This is a great way to meet people who share your interests. Tip 3: Ask questions. If you\'re not sure where something is or how something works, just ask. Tip 4: Be yourself. Don\'t pretend to be someone you\'re not. Tip 5: Give it time. Making friends and feeling comfortable takes time. Be patient and keep trying. You\'ll find your place before you know it.',
  };

  return texts[type] || 'This is a sample writing piece for demonstration purposes. It shows the format and structure of a typical response for this text type. The student has addressed the prompt and followed the expected structure to demonstrate their understanding of the genre.';
}
```

- [ ] **Step 2: Create demo route**

```typescript
// backend/src/routes/demo.ts
import { Router, Request, Response } from 'express';
import { loadDemoData, clearDemoData } from '../services/demo.service';

const router = Router();

router.post('/load', async (_req: Request, res: Response) => {
  try {
    const result = await loadDemoData();
    res.json(result);
  } catch (error) {
    console.error('Failed to load demo data:', error);
    res.status(500).json({ error: 'Failed to load demo data', status: 500 });
  }
});

router.post('/clear', async (_req: Request, res: Response) => {
  try {
    const result = await clearDemoData();
    res.json(result);
  } catch (error) {
    console.error('Failed to clear demo data:', error);
    res.status(500).json({ error: 'Failed to clear demo data', status: 500 });
  }
});

export default router;
```

- [ ] **Step 3: Register demo route**

```typescript
import demoRouter from './routes/demo';
app.use('/api/demo', demoRouter);
```

---

## Phase 6 — Look and Feel, and E2E Validation

### Task 6.1: Brand palette polish and banned element removal

- [ ] **Step 1: Verify brand palette applied everywhere**

Check all pages for consistent use of `brand-blue`, `brand-green`, `brand-amber` colors. Ensure no hardcoded blue/green/amber hex values that don't match.

- [ ] **Step 2: Remove banned elements**

Search the entire codebase for:
- Background gradients (`bg-gradient`, `bg-gradient-to-r`, etc.)
- Purple colors (`#purple`, `purple-`, etc.)
- Gradient buttons (`bg-gradient`)
- Single-side accent border lines (e.g., `border-l-4 border-brand-blue`)

- [ ] **Step 3: Polish Timed Practice screen**

Ensure the timed practice screen is calm and uncluttered:
- Large, readable timer
- Plain textarea with no formatting controls
- Muted, non-distracting colors
- Word count in a subtle position

### Task 6.2: Full E2E browser walkthrough

- [ ] **Step 1: Start the app**

```bash
cd /Users/km/AI/projects/claude-proj/coach && npm run dev
```

- [ ] **Step 2: Walk through every screen**

1. Open http://localhost:5173 → Dashboard with empty state
2. Expand Writing in sidebar → all 11 text types listed
3. Click a text type → PracticeHome with description and Start button
4. Click Start Timed Practice → see prompt, timer counting down, textarea
5. Type some text → word count updates
6. Click Submit Early → confirmation dialog → submit
7. Wait for AI analysis → see AttemptDetail with scores and feedback
8. Go back to Dashboard → heatmap showing the new attempt
9. Click the heatmap cell → ScoreHistory chart
10. Navigate to /admin → admin view with heatmap, worksheet generation, demo controls
11. Click Load Demo Data → heatmap populated with data
12. Click Clear Demo Data → heatmap back to original state
13. Generate a worksheet → confirm worksheet appears
14. Complete a worksheet attempt → verify it tracks in heatmap and history

- [ ] **Step 3: Check browser console**

Open browser DevTools console. Expected: No errors or warnings.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "complete: nsw selective writing coach with all 6 phases"
```

---

## Self-Review Checklist

- [ ] Spec coverage: All 6 phases and their success criteria map to tasks above
- [ ] Placeholder scan: No TBDs, TODOs, or vague steps
- [ ] Type consistency: API types match between frontend api.ts and backend routes
- [ ] All files referenced exist in the project structure
- [ ] Each task produces an independently testable deliverable