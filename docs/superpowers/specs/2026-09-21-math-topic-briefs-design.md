# Math Topic Briefs in Worksheet Generation — Design

Date: 2026-09-21
Status: Approved for planning

## Goal

Wire the tutor-authored generation instructions from `docs/targetted` (WIP) into the **math
worksheet** generation prompt so that, for a defined set of topics, the model produces
higher-quality, mistake-driven questions with precisely-specified figures.

Specifically, for the mapped topics, the generation prompt must carry:

1. **DISTRACTOR RULE** — every wrong option must be the answer produced by a real, named mistake
   (from the topic's common-error list), never a random number; at least two options per question
   reachable by a plausible slip.
2. **FIGURES rule** — any graph/scale/number line/protractor/shape must be specified precisely
   enough for a tutor to redraw by hand (exact axis labels, value of every gridline, count of
   unlabelled intervals, coordinates/side lengths), and axis intervals should deliberately avoid 1
   (use 1.1, 30, 2.5, …) so the student must compute the scale.
3. The **per-topic brief** — the topic's common errors and its question-mix requirements.

Scope decisions (confirmed with user):

- **Worksheets only.** Lesson generation (`coaching.service.ts`) is out of scope for this change.
- **Mapped topics only.** The rules/briefs are injected only when a selected topic maps to a brief.
- **Full brief including question mix**, reconciled with the batched generator (see Reconciliation).
- Structural approach **A**: a dedicated, testable `topic-briefs.ts` data module.
- An **A/B toggle** so the enhanced prompt can be compared against, and reverted to, the current
  baseline with no refactoring.

## Brief → topic-slug mapping

| Brief | Topic slug(s) |
|-------|---------------|
| 1. Graph and scale reading | `data-interpretation`, `protractor-skills` |
| 2. Time zones and elapsed time | `time-zones`, `time` |
| 3. Composite and rearranged shapes | `perimeter` |
| 4. Fractions of a remainder, ratio and ordering | `fractions` |

Notes: there are no distinct topics for "number lines / measuring cylinders" (folded into Brief 1
under `data-interpretation`) or standalone "ratio" (folded into Brief 4 under `fractions`). This
mapping is the reviewer's call to confirm.

## Architecture

### New module: `backend/src/services/topic-briefs.ts`

Exports a plain data map plus the two shared rule blocks and a small render helper. No model calls,
no DB — pure data + string building, so it is unit-testable in isolation.

```ts
export interface TopicBrief {
  title: string;            // e.g. "Graph and scale reading"
  commonErrors: string[];   // named mistakes → drive the DISTRACTOR RULE
  questionMix: string[];    // distribution requirements, phrased per ~10 questions
}

export const TOPIC_BRIEFS: Record<string, TopicBrief>; // keyed by topic slug

export const DISTRACTOR_RULE: string; // the shared block (verbatim from docs/targetted, lightly adapted)
export const FIGURES_RULE: string;    // the shared block (verbatim from docs/targetted, lightly adapted)

// Returns '' when no selected topic is briefed; otherwise the assembled
// per-topic brief blocks followed by the two shared rule blocks (each once).
export function buildTopicBriefSection(topicSlugs: string[]): string;
```

Two briefed topics share one brief entry per row above, so `data-interpretation` and
`protractor-skills` both point at the Brief 1 data (either duplicated entries keyed by each slug, or
one entry referenced by both keys — implementer's call; duplicated literal entries are fine and
clearest).

### Change to `buildGenerationBatchPrompt` (`ai.service.ts`)

- Add `briefVariant?: 'on' | 'off'` to `GenerationOpts`.
- Resolve `const variant = opts.briefVariant ?? DEFAULT_BRIEF_VARIANT;` where
  `DEFAULT_BRIEF_VARIANT` is a module constant derived once from
  `process.env.MATH_TOPIC_BRIEFS` (`'off'` only if explicitly set to `off`/`0`/`false`; default
  `'on'`).
- When `variant === 'off'` **the function returns exactly the current prompt** — no brief text is
  added. This is the guaranteed-safe revert path.
- When `variant === 'on'`, insert `buildTopicBriefSection(topics.map(t => t.slug))` into the prompt.
  If that returns `''` (no briefed topic selected), the prompt is again byte-for-byte the baseline.

### Injection point & interaction with existing rules

The brief section is inserted after the topic list / skill list and before the existing
"READABLE SLICES & ANGLES" and "MULTI-STEP DATA INTERPRETATION" blocks, so the more specific
existing guidance still reads as the final word.

Potential conflict to manage in wording: FIGURES says "deliberately avoid intervals of 1" for
**graph/number-line axis scales**, while the existing "READABLE SLICES & ANGLES" block requires
**clean, eye-readable pie slices and protractor angles**. These target different figure elements.
The FIGURES block will be scoped in its wording to **axis/gridline scales on graphs, number lines
and measuring scales** — it does not license awkward pie slices or protractor angles, which remain
governed by the existing block.

## Reconciliation: "full question mix" vs. batched generation

`generateMathWorksheetQuestions` calls `generateQuestionBatch` in independent batches of ≤10
(`GENERATION_BATCH_SIZE`), and a worksheet may span multiple topics. Independent batch calls cannot
see each other's output, so absolute whole-worksheet counts (e.g. "exactly three questions where the
interval is not a whole number") cannot be guaranteed.

Therefore each brief's `questionMix` is authored as **per-~10-questions proportional emphasis**, e.g.
"In roughly every 10 questions: at least 2 use a non-whole-number axis interval; at least 1 asks for
range, mean or total rather than a single reading; at least 1 hangs several sub-questions off the
same figure." This is honoured per batch and degrades gracefully for small worksheets. The intent of
the original absolute counts is preserved as ratios.

## A/B usage

- **Variant B (default, `on`):** brief-enhanced prompt for mapped topics.
- **Variant A (`off`):** current baseline prompt, unchanged.
- Compare by generating one worksheet each way (set `MATH_TOPIC_BRIEFS=off` for a baseline run, or
  pass `briefVariant` from a caller/test).
- **Revert:** set `MATH_TOPIC_BRIEFS=off` (runtime) or flip `DEFAULT_BRIEF_VARIANT` (permanent). No
  other code changes required; the injection is purely additive.

## Testing

- **Unit (`topic-briefs.test.ts`):** `buildTopicBriefSection` returns `''` for unbriefed topics;
  includes the DISTRACTOR RULE and FIGURES text and the correct per-topic common errors for each
  briefed slug; includes both rule blocks exactly once even when two briefed topics are selected.
- **Unit (extend `generation-uniqueness.test.ts` or a new prompt test):**
  `buildGenerationBatchPrompt` with `briefVariant:'on'` and a briefed topic contains the distractor
  and figures text; with `briefVariant:'off'` it does not; with `'on'` but only unbriefed topics it
  does not (equals baseline).
- **e2e:** a new/extended generation spec against the stubbed OpenAI (port 3106) confirming the
  admin generate flow still produces a valid worksheet with the default variant. Stub returns valid
  5-option questions; assert the worksheet renders. (Prompt-content assertions live in unit tests;
  the e2e proves the end-to-end path still works.)

## Out of scope

- Lesson prompts.
- Any UI surface for choosing the variant (env/opts only for now).
- The other structural pieces of `docs/targetted` (Method Box, Warm-up, Two-Minute Challenge,
  answer-key "if you chose X you probably…" lines) — those describe a differently-shaped worksheet
  document and are not part of this change.
