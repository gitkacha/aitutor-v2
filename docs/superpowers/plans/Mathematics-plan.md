# Mathematics Feature Plan — NSW Selective Writing Coach → Selective Prep Coach

## How this fits with the project plans

This document is a supplement to `CLAUDE.md` and `Writing-plan.md`, not a replacement. It follows
the same structure (features, success criteria, phases you cannot skip ahead of) and picks up
numbering at **Phase 7**, since `Writing-plan.md` runs through Phase 6 for the Writing feature.
Build Phases 7–12 in order, exactly as strictly as Phases 1–6: do not start a phase until the
previous one's success criteria are demonstrably met.

Once Mathematics ships, the product is no longer just a writing coach — rename the sidebar's mental
model (not necessarily the product name) to "subjects," with **Writing** and **Mathematics** as the
first two, built so a third (Reading) can slot in later the same way.

## Summary of the feature

The sidebar gains a second top-level item, **Mathematics**, sitting alongside **Writing**. Clicking
it expands to the topic categories tested in the Selective exam's Mathematical Reasoning section —
the same categories used in Alpha One Coaching College's own cohort reporting (see "Where the topic
list comes from" below). Choosing a topic lets the student run a timed, multiple-choice practice
test in that topic, styled after Alpha One's own trial-test format: five answer options per question,
a countdown timer, and — after submitting — a full review screen with the student's answer and the
correct answer both visible, right or wrong, with a written explanation per question. Scores are
saved automatically and roll into a Mathematics heatmap across all topics, exactly the way Writing
attempts roll into the Writing heatmap. Admin can generate AI-assisted worksheets targeted at the
weakest topics, at or above the difficulty of Alpha One's own reference test, and worksheet
performance is tracked the same way ordinary practice is.

## Where the topic list comes from

The person supplied two source documents:

- **Types.pdf** — a student cohort report ("Selective Trial Test Course 5"). Its Mathematics Test
Breakdown table (page 7) lists each question's category label alongside the student's answer, the
correct answer, and the percentage of the cohort who answered it correctly. This is the
authoritative list of Mathematical Reasoning topic categories for this app.
- **T5-Maths.pdf** — the actual 35-question trial test those categories were drawn from, with full
worked solutions and cohort answer statistics for every question.

**The twenty topic categories** (seed these as the Mathematics equivalent of Writing's eleven text
types):

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

**Test format to replicate**:

- Five answer options per question (labelled A–E in the source; the app need not show letters, but
must present exactly this style of single-select multiple choice).
- Some questions share one stimulus across a run of consecutive questions (e.g. the sample paper's
questions 25–28 all reference one line graph, all under "Speed, Distance, Time" — the header text
literally reads "Questions 25 to 28 refers to the following information"). Build for this: a
question can belong to a **stimulus group**, and grouped questions display the shared stimulus once,
followed by each question in turn.
- The reference paper is 35 questions in 40 minutes — a pace of roughly 68–69 seconds per question.
Reuse this pace (not necessarily 35 questions) when timing a topic-specific practice test — see
Phase 8.
- After the test, a review view shows, per question: the student's chosen answer, the correct
answer, a check or cross indicating right/wrong, and the worked explanation — matching the
"Question Feedback" block format in the source documents almost exactly (e.g. "Question Feedback:
Pattern is to multiply the previous number by 3 and add 1. … Therefore, the answer is Option C.").
- The source's per-question "% Correct" cohort statistic is not a student-facing feature — do not
show it to the student. It is useful only as an internal difficulty-calibration signal for worksheet
generation (see Phase 11).

## What the app keeps track of (new entities)

Alongside the existing WritingType / Prompt / Attempt / Analysis / Worksheet entities from
`Writing-plan.md`, add:

- **MathTopic** — one of the twenty categories above. Key info: name, a short description of what
the topic covers, and a rough difficulty benchmark (see Phase 11).
- **MathStimulusGroup** — an optional shared stimulus (text, table, or image description) that one or
more MathQuestions reference together, mirroring the source paper's grouped questions.
- **MathQuestion** — a single multiple-choice question. Key info: which MathTopic, an optional
MathStimulusGroup it belongs to, the question text, its answer options (label + text each), which
option is correct, a written explanation (styled like the source's "Question Feedback" blocks), and
a difficulty reference (see Phase 11) — plus whether it was hand-seeded from the reference paper or
AI-generated for a worksheet.
- **MathAttempt** — one completed (or timed-out) practice test. Key info: which MathTopic, the exact
set of MathQuestions and the order they were presented in, the student's chosen answer per question,
when it started and finished, time taken, whether it came from free practice or a MathWorksheet, and
its resulting score.
- **MathWorksheet** — an admin-created, AI-assisted worksheet targeting one or more weak MathTopics.
Key info: title, target topic(s), the generated MathQuestions, when it was created, and which
MathAttempts were completed against it — exactly parallel to the existing Writing Worksheet entity.

## Not in scope for the Mathematics feature (v1)

- No support yet for question formats beyond single-select multiple choice (no free-text numeric
entry, no drag-and-drop, no diagram-drawing questions) — even though some real Selective questions
use these, the source paper used here is entirely five-option multiple choice, so match that first.
- No support for images/diagrams inside questions beyond what can be expressed as styled text, simple
tables, or basic inline SVG (e.g. the source paper's protractor and magic-square questions can be
represented as a simple SVG or table rather than a photographic image).
- No cross-topic mixed test replicating the full 35-question T5-Maths paper end-to-end — practice
tests stay scoped to one topic at a time, consistent with how Writing practice is scoped to one text
type at a time (see the assumption called out in Phase 8).
- No adaptive difficulty within a single test (question order and difficulty are fixed once a test
starts).

## Phases

### Phase 7 — Data and sidebar

**Features**

- Add **Mathematics** as a second top-level sidebar item alongside **Writing**, expandable to list
all twenty MathTopics.
- Extend the SQLite schema with MathTopic, MathStimulusGroup, MathQuestion, MathAttempt and
MathWorksheet tables.
- A seed step that creates all twenty MathTopics (name + description) and hand-enters every question
from T5-Maths.pdf as seeded MathQuestions, correctly grouped into MathStimulusGroups where the
source groups them (e.g. questions 25–28), each with its real answer options, correct answer, and
explanation text transcribed from the source's "Question Feedback" sections. This seeded bank is
the foundation both practice tests and difficulty calibration will draw from.
- Unit tests to create, read, update and delete each new record type, and a test confirming every
seeded question's correct-answer field matches the source PDF's stated answer.

**Success criteria**

1. The sidebar shows both **Writing** and **Mathematics**; expanding Mathematics lists all twenty
topic categories.
2. The seed step populates all thirty-five questions from T5-Maths.pdf, correctly attributed to
their topic categories per Types.pdf's breakdown table, with stimulus groups preserved.
3. The unit tests for the new record types, and for seeded-answer accuracy, all pass.

### Phase 8 — Timed math practice test

**Assumption to confirm with the person before or during this phase:** a practice test is scoped to
**one MathTopic at a time** (mirroring Writing's one-text-type-at-a-time model), not a mixed
35-question paper. If this doesn't match their expectation, revisit before continuing.

**Features**

- Clicking a MathTopic shows its practice home: a short description of the topic, the student's
attempt history for it, and a **Start Timed Practice** button.
- Starting practice assembles a set of questions for that topic (including any stimulus groups whose
questions belong to it), at the source paper's pace of roughly 69 seconds per question (e.g. 10
questions ≈ 11–12 minutes) — question count and exact pace are configurable, but must default to
something proportionate to the reference pace, not an arbitrary round number.
- The Timed Practice screen: the current question (with its shared stimulus shown once, above the
group, if applicable), five single-select answer options, a visible countdown, and a **Next**/
**Submit** flow. The test auto-submits on timeout and can be submitted early once every question has
been answered or the student chooses to submit with some left blank.
- Completed attempts save automatically: every question asked, the student's chosen answer for each,
timing, and topic.
- Unit tests for starting a topic test, assembling stimulus groups correctly, auto-saving on timeout,
and manual submission.

**Success criteria**

1. Starting practice for any MathTopic shows a question with five answer options and a visibly
running countdown paced proportionately to the reference test.
2. Questions belonging to a stimulus group display the shared stimulus once, followed by each of
that group's questions in sequence, matching the source paper's "Questions X to Y refers to the
following information" pattern.
3. Submitting early, or letting the timer reach zero, saves the attempt with every answer the student
selected (or left blank) and the actual time taken.
4. A saved attempt is still there, unchanged, after a browser refresh.
5. The unit tests for topic-test assembly, auto-save and manual submission all pass.

### Phase 9 — Scoring and answer review

**Features**

- On submission, score the attempt against the stored correct answers.
- A Math Attempt Review page, styled after the source "Analyze Quiz" report: overall score (X/Y and
percentage) and time taken at the top, then every question in order, each showing the student's
answer, the correct answer, a clear right/wrong indicator, and the full written explanation —
regardless of whether the student got it right, so they can learn from both correct and incorrect
answers.
- Unit tests for scoring accuracy and for the review view rendering every question with the correct
right/wrong indicator.

**Success criteria**

1. After submitting a topic practice test, the review page shows a total score and percentage that
correctly reflects the number of questions answered correctly.
2. Every question in the review shows the student's chosen answer, the correct answer clearly
highlighted, a right/wrong indicator, and its explanation — matching the source documents'
"Question Feedback" style closely enough that a parent familiar with Alpha One's reports would
recognise the format.
3. The unit tests for scoring and review rendering pass.

### Phase 10 — Mathematics heatmap and progress tracking

**Features**

- Extend the existing Progress Dashboard heatmap (or add a parallel Mathematics heatmap, whichever
reads more naturally alongside Writing's) with one cell per MathTopic, shaded by performance.
- Clicking a cell shows that topic's score history over time, exactly as Writing's heatmap drill-down
already works.
- Unit tests confirming the Mathematics heatmap reflects the underlying attempt scores.

**Success criteria**

1. The heatmap shows all twenty MathTopics, shaded to reflect recorded performance, with an
encouraging empty state for topics with no attempts yet — matching the empty-by-default behaviour
established for Writing in `Writing-plan.md`.
2. Completing a new topic practice test updates the relevant heatmap cell after a refresh.
3. Clicking a heatmap cell shows a chronological history of scores for that topic.
4. The unit tests for heatmap accuracy pass.

### Phase 11 — AI-assisted math worksheets, calibrated to reference difficulty

**Features**

- Extend the existing Admin view's **Generate Worksheet** action to also support Mathematics: admin
picks one or more weak MathTopics (surfaced from the heatmap) and generates an AI-assisted
MathWorksheet.
- **Difficulty floor, grounded in the reference paper:** the seeded MathQuestions from Phase 7
already carry the source paper's real cohort **% Correct** figures per question. Use each MathTopic's
seeded questions (and their % Correct values) as few-shot difficulty exemplars in the generation
prompt — instruct the AI explicitly to produce questions it judges to be of **equal or greater
difficulty** than the lowest % Correct exemplar(s) for that topic (i.e. calibrate against the hardest
known real question in that category, not the easiest), and to match the reference paper's reasoning
style (multi-step word problems, plausible-but-wrong distractors, the same "Question Feedback"
worked-explanation format).
- Because there's no live cohort to measure actual difficulty against, this is a prompting/exemplar
constraint, not a measured guarantee — the admin review step (below) is the real safety net.
- Generated questions are shown to Admin for review before being assembled into the MathWorksheet and
made available to the student, exactly as the existing Writing worksheet flow already requires
review before assignment.
- Completing a MathWorksheet produces MathAttempts and scoring exactly like ordinary topic practice,
and rolls into the same Mathematics heatmap and history.
- Extend the existing **Load Demo Data** / **Clear Demo Data** admin controls (from `CLAUDE.md`
Phase 5) to also seed a believable spread of MathAttempts across most or all twenty topics, and at
least one completed MathWorksheet — kept invisible on the student-facing side, same as the Writing
demo data.
- Unit tests for worksheet generation (with the AI call mocked), difficulty-exemplar selection, admin
review, and worksheet-attempt completion.

**Success criteria**

1. From Admin, generating a Mathematics worksheet for a chosen weak topic produces multiple-choice
questions in the same five-option format as the seeded bank, each with an explanation in the source
paper's style, shown for review before assignment.
2. The generation prompt demonstrably includes the target topic's hardest seeded exemplar
question(s) (lowest % Correct) as a difficulty floor, and admin can see or verify this during review
(e.g. the reviewed questions are, on inspection, at least as demanding as that exemplar).
3. The student can complete an assigned MathWorksheet under the same timed, single-select conditions
as ordinary topic practice, and see the same score-and-review page afterwards.
4. A completed worksheet attempt appears in that topic's score history and updates the Mathematics
heatmap, indistinguishable in the data model from a regular practice attempt except for its
worksheet link.
5. **Load Demo Data** populates Mathematics attempts, scores and at least one completed worksheet
across most or all topics; **Clear Demo Data** removes them cleanly without touching real student
attempts, and neither control is visible on the student-facing side.
6. The unit tests for worksheet generation, exemplar selection, admin review and attempt completion
all pass.

### Phase 12 — Look and feel, and end-to-end validation

**Features**

- Apply the existing brand palette and look-and-feel rules (from `CLAUDE.md`) to every new
Mathematics screen — topic list, timed practice, review, heatmap, admin worksheet flow.
- A full end-to-end walkthrough in a real browser, covering Mathematics specifically alongside
Writing.

**Success criteria**

1. Every new Mathematics screen follows the established look-and-feel rules and contains none of the
banned elements (background gradients, purple backgrounds, gradient buttons, single-side accent
border lines).
2. The Coding Agent has driven the running app end to end for Mathematics — expanded the sidebar into
Mathematics, started and completed a timed topic practice test (both by early submission and by
timeout), reviewed the scored results with correct answers highlighted, checked the Mathematics
heatmap and its drill-down, generated and reviewed an admin worksheet at or above reference
difficulty, completed that worksheet as a student, and confirmed it tracks alongside ordinary
practice — visually inspecting every screen.
3. No errors appear in the browser console during that walkthrough.

## Final success criteria for the Mathematics feature

The feature is complete when all of the following are true, in addition to everything already true
of the Writing feature in `Writing-plan.md`:

- The sidebar's Mathematics item expands to all twenty topic categories drawn from Types.pdf.
- Every question from T5-Maths.pdf is seeded, correctly grouped by stimulus and topic, with accurate
answers and explanations.
- A timed topic practice test replicates the reference paper's five-option format, stimulus grouping,
and per-question pace.
- Every completed attempt produces a score and a full answer review with correct answers highlighted
and explanations shown for every question.
- The Mathematics heatmap accurately reflects performance across all twenty topics and updates as new
attempts land.
- Admin can generate AI-assisted math worksheets calibrated to be at or above the reference paper's
hardest known question in the target topic, reviewed before assignment, with performance tracked
over time alongside ordinary practice.
- Demo data for Mathematics lives only in Admin, exactly like Writing's.
- The look-and-feel rules are met and none of the banned elements appear anywhere.
- All unit tests pass.
- **Most importantly: the feature has been validated by actually using it end to end in a real
browser** — as a real student and a real admin would — not merely by passing unit tests.
