# Math Topic Briefs in Worksheet Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject tutor-authored topic briefs (common errors, question mix) plus a DISTRACTOR RULE and a FIGURES rule into the math worksheet generation prompt, for a mapped set of topics only, behind an A/B toggle that reverts to the exact current prompt.

**Architecture:** A new pure-data module `topic-briefs.ts` holds the four briefs (keyed by topic slug), the two shared rule blocks, and a `buildTopicBriefSection(slugs)` renderer that returns `''` when no selected topic is briefed. `buildGenerationBatchPrompt` gains a `briefVariant` option (default from `MATH_TOPIC_BRIEFS` env, `'on'`); when `'on'` it splices the rendered section in before the existing "READABLE SLICES & ANGLES" block; when `'off'` (or no briefed topic selected) the emitted prompt is byte-for-byte the current baseline.

**Tech Stack:** TypeScript, Vitest (unit), Playwright (e2e), Express backend, existing OpenAI service layer.

## Global Constraints

- Worksheets only — do NOT modify `coaching.service.ts` (lesson) prompts.
- Mapped topics only — briefs apply to: `data-interpretation`, `protractor-skills` (Brief 1); `time-zones`, `time` (Brief 2); `perimeter` (Brief 3); `fractions` (Brief 4). All other topics unchanged.
- Variant `off` (or no briefed topic in the selection) MUST produce the exact current prompt — the injection is purely additive.
- Question-mix requirements are authored as **per-~10-questions proportional emphasis**, never absolute whole-worksheet counts (the generator runs independent batches of ≤10 that cannot coordinate totals).
- e2e tests run against the isolated stack: backend 3105, frontend 5273, stubbed OpenAI on 3106, `e2e.db` — never `dev.db`, never the real API.
- Follow the mandatory workflow: worklog items are created (below) before code; ticked only after user sign-off with commit hash + proof.

## Worklog items (create in `docs/worklog.md` before Task 1)

Add these unchecked items:

```markdown
- [ ] W-140: Add topic-briefs.ts (4 briefs + DISTRACTOR & FIGURES rule blocks + buildTopicBriefSection renderer), unit-tested
- [ ] W-141: Wire topic briefs into buildGenerationBatchPrompt behind the MATH_TOPIC_BRIEFS A/B toggle (briefVariant opt); off/unbriefed = baseline prompt
- [ ] W-142: e2e — default (variant on) generation for a briefed topic sends the DISTRACTOR/FIGURES text to OpenAI and still produces a valid worksheet
```

## File Structure

- **Create** `backend/src/services/topic-briefs.ts` — brief data, `DISTRACTOR_RULE`, `FIGURES_RULE`, `buildTopicBriefSection`.
- **Create** `backend/src/services/topic-briefs.test.ts` — unit tests for the renderer/data.
- **Modify** `backend/src/services/ai.service.ts` — import the renderer; add `briefVariant` to `GenerationOpts`; add `DEFAULT_BRIEF_VARIANT`; splice the section into `buildGenerationBatchPrompt`.
- **Modify** `backend/src/services/generation-uniqueness.test.ts` — add a `describe('buildGenerationBatchPrompt topic briefs')` block (co-located with the existing prompt tests).
- **Create** `e2e/math-topic-briefs.spec.ts` — end-to-end proof via the OpenAI stub.

---

### Task 1: `topic-briefs.ts` data module + renderer

**Files:**
- Create: `backend/src/services/topic-briefs.ts`
- Test: `backend/src/services/topic-briefs.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export interface TopicBrief { title: string; commonErrors: string[]; questionMix: string[]; }`
  - `export const TOPIC_BRIEFS: Record<string, TopicBrief>` (keyed by topic slug)
  - `export const DISTRACTOR_RULE: string`
  - `export const FIGURES_RULE: string`
  - `export function buildTopicBriefSection(topicSlugs: string[]): string`

- [ ] **Step 1: Write the failing test**

Create `backend/src/services/topic-briefs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildTopicBriefSection, TOPIC_BRIEFS } from './topic-briefs';

describe('TOPIC_BRIEFS mapping', () => {
  it('maps the four briefs to their topic slugs', () => {
    expect(TOPIC_BRIEFS['data-interpretation'].title).toBe('Graph and scale reading');
    expect(TOPIC_BRIEFS['protractor-skills'].title).toBe('Graph and scale reading');
    expect(TOPIC_BRIEFS['time-zones'].title).toBe('Time zones and elapsed time');
    expect(TOPIC_BRIEFS['time'].title).toBe('Time zones and elapsed time');
    expect(TOPIC_BRIEFS['perimeter'].title).toBe('Composite and rearranged shapes');
    expect(TOPIC_BRIEFS['fractions'].title).toBe('Fractions of a remainder, ratio and ordering');
  });
});

describe('buildTopicBriefSection', () => {
  it('returns empty string when no selected topic is briefed', () => {
    expect(buildTopicBriefSection(['arithmetic', 'algebra'])).toBe('');
    expect(buildTopicBriefSection([])).toBe('');
  });

  it('includes the DISTRACTOR RULE and FIGURES rule and the topic common errors', () => {
    const text = buildTopicBriefSection(['data-interpretation']);
    expect(text).toContain('DISTRACTOR RULE');
    expect(text.toLowerCase()).toContain('four wrong options');
    expect(text).toContain('FIGURES');
    expect(text.toLowerCase()).toContain('avoid an interval of 1');
    expect(text).toContain('Graph and scale reading');
    expect(text.toLowerCase()).toContain('counting gridlines instead of the gaps');
  });

  it('emits each shared rule block exactly once even with two briefed topics selected', () => {
    const text = buildTopicBriefSection(['data-interpretation', 'protractor-skills', 'perimeter']);
    // data-interpretation + protractor-skills share ONE brief → its title appears once
    expect(text.match(/Graph and scale reading/g)!.length).toBe(1);
    expect(text.match(/Composite and rearranged shapes/g)!.length).toBe(1);
    expect(text.match(/DISTRACTOR RULE/g)!.length).toBe(1);
    expect(text.match(/^FIGURES/gm)!.length).toBe(1);
  });

  it('renders the question mix as per-10 proportional emphasis (no bare absolute counts)', () => {
    const text = buildTopicBriefSection(['time-zones']);
    expect(text.toLowerCase()).toContain('in roughly every 10 questions');
    expect(text.toLowerCase()).toContain('two-hop');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/services/topic-briefs.test.ts`
Expected: FAIL — `Cannot find module './topic-briefs'`.

- [ ] **Step 3: Write the module**

Create `backend/src/services/topic-briefs.ts`:

```ts
// W-140: tutor-authored topic briefs spliced into the math worksheet generation prompt
// (docs/targetted, WIP). Pure data + string building — no model calls, no DB — so the whole
// thing is unit-testable in isolation and easy to A/B against the baseline prompt.

export interface TopicBrief {
  title: string;
  /** Named mistakes — each must be reachable as a wrong option (drives the DISTRACTOR RULE). */
  commonErrors: string[];
  /**
   * Distribution requirements, authored as PER-~10-QUESTIONS proportional emphasis (never absolute
   * whole-worksheet counts): generation runs in independent batches of <=10 that cannot coordinate
   * totals, so ratios are the only thing each batch can honour.
   */
  questionMix: string[];
}

const GRAPH_SCALE_BRIEF: TopicBrief = {
  title: 'Graph and scale reading',
  commonErrors: [
    'assuming each gridline is worth 1 unit',
    'reading the wrong points for the range the question actually asks about',
    'giving a single plotted value when the question asks for an average or a total',
    'counting gridlines instead of the gaps between them',
  ],
  questionMix: [
    'In roughly every 10 questions, at least 3 must use a non-whole-number axis/scale interval (e.g. 1.1, 2.5 or 30) so the student has to work out the scale.',
    'At least 2 in every 10 must hang several sub-questions off the SAME figure (reuse one graph or table across a small cluster).',
    'At least 2 in every 10 must ask for a range, mean or total rather than a single reading.',
  ],
};

const TIME_BRIEF: TopicBrief = {
  title: 'Time zones and elapsed time',
  commonErrors: [
    'adding hours when the situation requires subtracting (or vice versa)',
    'stopping after the first conversion in a two-hop problem',
    'flipping am and pm',
    'minute-arithmetic slips when crossing an hour boundary',
  ],
  questionMix: [
    'In roughly every 10 questions, at least 3 must be two-hop problems (city A to city B to city C).',
    'At least 2 in every 10 must cross midnight into the next day.',
    'At least 2 in every 10 must use a half-hour offset such as +11:15 or +9:30.',
  ],
};

const SHAPE_BRIEF: TopicBrief = {
  title: 'Composite and rearranged shapes',
  commonErrors: [
    'forgetting to account for unlabelled sides',
    'mixing up cm² and m² (missing the unit conversion)',
    'assuming the perimeter is unchanged when the pieces are rearranged',
  ],
  questionMix: [
    'In roughly every 10 questions, at least 3 must break a shape apart and rebuild it, then ask for the NEW perimeter.',
    'At least 2 in every 10 must be set on a grid with a stated scale per square.',
    'At least 2 in every 10 must require a unit conversion in the final answer.',
  ],
};

const FRACTIONS_BRIEF: TopicBrief = {
  title: 'Fractions of a remainder, ratio and ordering',
  commonErrors: [
    'taking the second fraction of the ORIGINAL amount instead of the remainder',
    'failing to work backwards from a final amount to the starting amount',
    'misordering a mix of fractions, decimals and percentages',
  ],
  questionMix: [
    'In roughly every 10 questions, at least 4 must be working-backwards problems (given the final amount, find the start).',
    'At least 3 in every 10 must be "arrange these and name the middle one" questions mixing fractions, decimals and percentages.',
    'At least 3 in every 10 must be ratio-scaling problems with a non-whole-number share.',
  ],
};

// Two topics can share one brief (Brief 1 covers both graphs and protractor scales); the shared
// object identity lets buildTopicBriefSection de-duplicate when both are selected.
export const TOPIC_BRIEFS: Record<string, TopicBrief> = {
  'data-interpretation': GRAPH_SCALE_BRIEF,
  'protractor-skills': GRAPH_SCALE_BRIEF,
  'time-zones': TIME_BRIEF,
  time: TIME_BRIEF,
  perimeter: SHAPE_BRIEF,
  fractions: FRACTIONS_BRIEF,
};

export const DISTRACTOR_RULE = `DISTRACTOR RULE — the most important instruction. Every question's four wrong options must be the answer a student would actually get from a real, specific mistake — never a random or filler number. Draw those mistakes from the "Common errors" listed for the question's topic above. At least two of the four wrong options in every question must be reachable by a plausible slip. In the explanation, name the mistake behind at least one wrong option, e.g. "If you chose B, you counted the gridlines instead of the gaps."`;

export const FIGURES_RULE = `FIGURES — DRAW THEM ACCURATELY. Any graph, scale, number line, measuring cylinder, protractor or shape must be specified precisely enough that a tutor could redraw it by hand: give exact axis labels, the value of every gridline, the number of unlabelled intervals between labelled points, and the coordinates or side lengths of every plotted point or vertex. For the AXIS or SCALE intervals of graphs, number lines and measuring scales, deliberately avoid an interval of 1 — use an interval like 1.1, 2.5 or 30 so the student must work out the scale rather than assume each gridline is 1. (This applies to axis/scale intervals only; pie-chart slices and protractor angles stay clean and eye-readable as required elsewhere in this prompt.)`;

/**
 * Assembles the per-topic brief blocks (de-duplicated by shared brief identity) followed by the two
 * shared rule blocks, each once. Returns '' when none of the selected topics is briefed, so the
 * caller can keep the baseline prompt byte-for-byte.
 */
export function buildTopicBriefSection(topicSlugs: string[]): string {
  const briefs: TopicBrief[] = [];
  const seen = new Set<TopicBrief>();
  for (const slug of topicSlugs) {
    const brief = TOPIC_BRIEFS[slug];
    if (brief && !seen.has(brief)) {
      seen.add(brief);
      briefs.push(brief);
    }
  }
  if (briefs.length === 0) return '';

  const blocks = briefs
    .map(
      (b) =>
        `TOPIC BRIEF — ${b.title}\nCommon errors (use these to build the wrong options):\n${b.commonErrors
          .map((e) => `- ${e}`)
          .join('\n')}\nQuestion mix for this topic:\n${b.questionMix.map((m) => `- ${m}`).join('\n')}`,
    )
    .join('\n\n');

  return `${blocks}\n\n${DISTRACTOR_RULE}\n\n${FIGURES_RULE}\n\nVary the names, contexts and objects across questions so repeat worksheets don't feel recycled.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/services/topic-briefs.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/topic-briefs.ts backend/src/services/topic-briefs.test.ts docs/worklog.md
git commit -m "feat(W-140): add topic-briefs data module + renderer for math generation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Wire briefs into `buildGenerationBatchPrompt` behind the A/B toggle

**Files:**
- Modify: `backend/src/services/ai.service.ts` (`GenerationOpts` ~L628; add `DEFAULT_BRIEF_VARIANT` near `OPTION_WORD` ~L633; splice into the template ~before the "READABLE SLICES & ANGLES" block ~L715; add import at top)
- Test: `backend/src/services/generation-uniqueness.test.ts` (add a new `describe` block)

**Interfaces:**
- Consumes: `buildTopicBriefSection` from `./topic-briefs` (Task 1).
- Produces: `GenerationOpts.briefVariant?: 'on' | 'off'`; `buildGenerationBatchPrompt` unchanged signature but brief-aware.

- [ ] **Step 1: Write the failing test**

Add to `backend/src/services/generation-uniqueness.test.ts` (append at end of file):

```ts
import { buildGenerationBatchPrompt } from './ai.service';

const topic = (slug: string, name: string) => ({
  id: 1, name, slug, description: `${name} description`,
  questions: [{ id: 1, questionText: `hardest ${name} q`, options: '[]', correctIndex: 0, explanation: '', percentCorrect: 20 }],
});

describe('buildGenerationBatchPrompt — topic briefs A/B', () => {
  it("variant 'on' with a briefed topic injects the DISTRACTOR and FIGURES rules", () => {
    const prompt = buildGenerationBatchPrompt([topic('data-interpretation', 'Data Interpretation')], 10, [], { briefVariant: 'on' });
    expect(prompt).toContain('DISTRACTOR RULE');
    expect(prompt).toContain('FIGURES — DRAW THEM ACCURATELY');
    expect(prompt.toLowerCase()).toContain('counting gridlines instead of the gaps');
  });

  it("variant 'off' emits the baseline prompt (no brief text) for a briefed topic", () => {
    const t = [topic('data-interpretation', 'Data Interpretation')];
    const off = buildGenerationBatchPrompt(t, 10, [], { briefVariant: 'off' });
    expect(off).not.toContain('DISTRACTOR RULE');
    expect(off).not.toContain('FIGURES — DRAW THEM ACCURATELY');
  });

  it("variant 'on' with only unbriefed topics equals the baseline (no brief text)", () => {
    const t = [topic('arithmetic', 'Arithmetic')];
    const on = buildGenerationBatchPrompt(t, 10, [], { briefVariant: 'on' });
    const off = buildGenerationBatchPrompt(t, 10, [], { briefVariant: 'off' });
    expect(on).toBe(off);
    expect(on).not.toContain('DISTRACTOR RULE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/services/generation-uniqueness.test.ts`
Expected: FAIL — first test: prompt does not contain "DISTRACTOR RULE" (brief not wired yet).

- [ ] **Step 3: Add the import**

At the top of `backend/src/services/ai.service.ts`, with the other local imports, add:

```ts
import { buildTopicBriefSection } from './topic-briefs';
```

- [ ] **Step 4: Add `briefVariant` to `GenerationOpts` and the default constant**

Change `GenerationOpts` (currently ~L628) to:

```ts
export interface GenerationOpts {
  optionCount?: number; // 5 for math (default), 4 for thinking-skills
  subject?: string;     // 'math' (default) | 'thinking-skills' — selects the figure vocabulary
  briefVariant?: 'on' | 'off'; // W-141 A/B: 'on' splices topic briefs in; 'off' = baseline prompt
}
```

Immediately after the `OPTION_WORD` constant (currently ~L633) add:

```ts
// W-141 A/B toggle for the topic-brief injection. Default 'on'; set MATH_TOPIC_BRIEFS=off (or 0 /
// false) to revert to the pre-brief baseline prompt with zero code changes. Read once at load.
const DEFAULT_BRIEF_VARIANT: 'on' | 'off' =
  /^(off|0|false)$/i.test(process.env.MATH_TOPIC_BRIEFS ?? '') ? 'off' : 'on';
```

- [ ] **Step 5: Splice the section into the prompt**

Inside `buildGenerationBatchPrompt`, after the `extraFigures`/`exemplars` setup and before the `return \`You are a mathematics tutor...\``, add:

```ts
  const briefVariant = opts.briefVariant ?? DEFAULT_BRIEF_VARIANT;
  // '' when variant is 'off' OR no selected topic is briefed → prompt stays byte-for-byte baseline.
  const briefSection = briefVariant === 'on' ? buildTopicBriefSection(topics.map((t) => t.slug)) : '';
```

Then, in the template literal, find the existing block that begins:

```
READABLE SLICES & ANGLES. When a pie-chart, protractor or rotation asks the student to READ or
```

and change its opening so the brief section is spliced immediately before it:

```ts
${briefSection ? briefSection + '\n\n' : ''}READABLE SLICES & ANGLES. When a pie-chart, protractor or rotation asks the student to READ or
```

(When `briefSection` is `''` the surrounding text is unchanged, guaranteeing the baseline prompt.)

- [ ] **Step 6: Run the new tests to verify they pass**

Run: `cd backend && npx vitest run src/services/generation-uniqueness.test.ts`
Expected: PASS (existing tests + 3 new brief tests).

- [ ] **Step 7: Run the full backend unit suite**

Run: `cd backend && npx vitest run`
Expected: PASS (no regressions; existing `ts-generation.test.ts` prompt assertions still hold — briefs default 'on' but thinking-skills topics are not in `TOPIC_BRIEFS`, so its prompt is unchanged).

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/ai.service.ts backend/src/services/generation-uniqueness.test.ts docs/worklog.md
git commit -m "feat(W-141): wire topic briefs into math generation prompt behind MATH_TOPIC_BRIEFS A/B toggle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: e2e — default-on generation for a briefed topic

**Files:**
- Create: `e2e/math-topic-briefs.spec.ts`

**Interfaces:**
- Consumes: `generateMath` from `./helpers/generate` (drives the POST → poll job flow); the OpenAI stub on port 3106.
- Produces: nothing (test-only).

This proves the end-to-end path with the shipping default (variant `on`): the outgoing generation prompt for a briefed topic carries the DISTRACTOR/FIGURES text, and the worksheet still generates. The stub captures the generation request body to assert on the prompt.

- [ ] **Step 1: Write the e2e spec**

Create `e2e/math-topic-briefs.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { generateMath } from './helpers/generate';
import http from 'http';

// W-142: with the default variant (MATH_TOPIC_BRIEFS on), generating a worksheet for a briefed
// topic (data-interpretation) must send the DISTRACTOR RULE + FIGURES rule in the prompt to OpenAI,
// and still produce a valid worksheet. Baseline (variant off) is covered by unit tests.

test.use({ storageState: 'e2e/.auth/admin.json' });

const STUB_PORT = 3106;

const good = (n: number) => ({
  questionText: `BRIEFQ${n}: a line graph rises from 2.2 to 6.6; what is the total increase?`,
  options: ['4.4', '2.2', '6.6', '8.8', '3.3'],
  correctIndex: 0,
  explanation: '6.6 - 2.2 = 4.4. If you chose 6.6 you read the end value instead of the increase. Therefore, the answer is Option A.',
  topicSlug: 'data-interpretation',
  topicName: 'Data Interpretation',
  skillSlug: 'bar-and-line-graphs',
});

function startStub(log: { sawDistractor: boolean; sawFigures: boolean }): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const content: string = JSON.parse(body).messages?.[0]?.content || '';
      let reply: unknown;
      if (content.includes('audit its answer key')) {
        reply = { correctIndex: 0 };
      } else if (content.includes('skill tag')) {
        reply = { skillSlug: 'bar-and-line-graphs' };
      } else {
        // This is the generation call — record whether the briefs made it into the prompt.
        if (content.includes('DISTRACTOR RULE')) log.sawDistractor = true;
        if (content.includes('FIGURES — DRAW THEM ACCURATELY')) log.sawFigures = true;
        reply = [1, 2, 3, 4, 5].map(good);
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
    });
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}

test.describe('W-142 — topic briefs reach the generation prompt (default variant)', () => {
  test('briefed topic generation sends DISTRACTOR + FIGURES rules and yields a valid worksheet', async ({ request }) => {
    const log = { sawDistractor: false, sawFigures: false };
    const stub = await startStub(log);
    try {
      const result = await generateMath(request, { topicIds: ['data-interpretation'], questionCount: 5 });
      expect(result.questions.length).toBe(5);
      expect(log.sawDistractor, 'DISTRACTOR RULE reached the generation prompt').toBe(true);
      expect(log.sawFigures, 'FIGURES rule reached the generation prompt').toBe(true);
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });
});
```

- [ ] **Step 2: Run the new e2e spec to verify it passes**

Run: `npx playwright test e2e/math-topic-briefs.spec.ts`
Expected: PASS. (If the isolated e2e stack is not already running, start it per the project's e2e setup — backend 3105 / frontend 5273 / `e2e.db` — then re-run. The generation env for e2e must NOT set `MATH_TOPIC_BRIEFS=off`; the default is `on`.)

- [ ] **Step 3: Run the full e2e suite**

Run: `npm run e2e`
Expected: PASS (no regressions — existing math generation specs use unbriefed topics like `arithmetic`, whose prompt is unchanged).

- [ ] **Step 4: Run the full unit suite once more**

Run: `cd backend && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/math-topic-briefs.spec.ts docs/worklog.md
git commit -m "test(W-142): e2e — briefed-topic generation sends DISTRACTOR/FIGURES rules to OpenAI

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Post-implementation (mandatory workflow step 5)

- [ ] Confirm both suites green: `npm run e2e` and `cd backend && npx vitest run`.
- [ ] Manual A/B check with `npm run dev`: generate a `data-interpretation` worksheet with the default (briefs on) and inspect that distractors are mistake-driven and figures specify scales; optionally set `MATH_TOPIC_BRIEFS=off` in the backend env and regenerate to compare against baseline. (No UI screenshot needed unless output rendering changed — this change is prompt-only.)
- [ ] Hand over to the user: dev servers running, summary of changes, and the proving specs (`topic-briefs.test.ts`, the `generation-uniqueness.test.ts` brief block, `e2e/math-topic-briefs.spec.ts`).
- [ ] Only after explicit user approval, tick W-140/W-141/W-142 in `docs/worklog.md` with commit hashes + proof.

## Self-Review

- **Spec coverage:** DISTRACTOR RULE + FIGURES rule (Task 1 `DISTRACTOR_RULE`/`FIGURES_RULE`); per-topic briefs incl. common errors + question mix (Task 1 `TOPIC_BRIEFS`); mapped-topics-only (`buildTopicBriefSection` returns '' otherwise, verified Task 1 + Task 2 test 3); worksheets-only (only `ai.service.ts` touched; `coaching.service.ts` untouched — Global Constraints); A/B toggle + zero-refactor revert (Task 2 `briefVariant`/`DEFAULT_BRIEF_VARIANT`/`MATH_TOPIC_BRIEFS`, off=baseline verified Task 2 test 2); batched-generation reconciliation (question mix authored per-10 — Task 1 data + test 4); injection point before READABLE SLICES & ANGLES (Task 2 Step 5); testing (unit + e2e Tasks 1–3). All spec sections covered.
- **Placeholder scan:** none — every code and test step is complete.
- **Type consistency:** `TopicBrief`, `TOPIC_BRIEFS`, `buildTopicBriefSection(string[]) => string`, `GenerationOpts.briefVariant: 'on' | 'off'`, `DEFAULT_BRIEF_VARIANT` used consistently across Tasks 1–2; e2e uses the existing `generateMath` signature and `topicIds` field (matches `m3a-generation-tags.spec.ts`).
