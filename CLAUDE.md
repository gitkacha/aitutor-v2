# NSW Selective Prep Coach — Project-wide Guidelines

## Summary

NSW Selective Prep Coach is a practice and progress-tracking tool for the NSW Selective High School
Placement Test. It runs on your own computer — think of it as a private tutor and test simulator.
It helps a student practise every subject tested in the Selective exam under real exam time pressure,
automatically tracks how they perform over time, and helps a parent or tutor spot weak areas and
generate targeted practice. It runs locally, needs no login, and works entirely on your machine.

The goal is a clean, focused tool that does the essentials really well: a sidebar for choosing a
subject and topic; timed practice tests that replicate the real exam's conditions; a heatmap showing
strength and weakness across topics; detailed feedback on every completed attempt; and an admin view
that turns the heatmap into AI-generated worksheets, whose results feed back into the same tracking.

## Subject plans

Writing phases and requirements are documented in `docs/superpowers/plans/Writing-plan.md`.

Mathematics phases and requirements are documented in `docs/superpowers/plans/Mathematics-plan.md`.

Each plan has its own final success criteria. Build in phase-order within each plan. Do not start a
phase until every success criterion of the previous phase is demonstrably met.

## High-level technical guidance

Just enough direction to keep things on track — specific choices are left to the Coding Agent.

- Build it as a single web app using **Vite, React and TypeScript**.
- It runs fully locally and starts with **one simple command**; no accounts, no cloud, no internet
needed to use it, other than the AI calls described below.
- It stores its data **locally on the machine** in a **SQLite** database file.
- Use the **OpenAI API** (a `.env`-provided API key) for AI-assisted features: analysis of
writing attempts and generating worksheet content. Keep these calls isolated behind a small service
layer so the rest of the app doesn't care how the analysis was produced. Use **gpt-4o-mini**
as the model to start with.
- **Prefer popular, well-supported libraries over custom code** — for the data tables, the heatmap
and charts, and the countdown timer. Don't hand-roll what a mature library does well.
- Keep the implementation simple and conventional. Library, data and structure choices are the
Coding Agent's call, as long as the requirements and the success criteria are met.

## Not in scope (v1)

Deliberately left out to keep this small and focused. Do not build these:

- No handwriting input, scanning or OCR — responses are typed, matching the real computer-based test.
- No live proctoring, plagiarism detection or exam-integrity tooling.
- No mobile app; a responsive web layout is enough.
- No multi-language support; English only.
- No table pagination, and no data import or export.

## Look and feel

Applies to the whole app:

- Make it **sharp and modern, but still clean and encouraging** — this is a tool a nervous
11-year-old will use under a countdown timer, so the Timed Practice screen especially should feel
calm and uncluttered.
- Use the color palette **`#1c6dd0` (blue), `#2e9e5b` (green) and `#f2a71b` (amber)**, together with
grays. The heatmap uses its own red-to-green performance scale and is exempt from the brand palette.
- **Avoid** these — they read as generic "AI-generated" tells: background gradients, purple
backgrounds, buttons with gradients, and panels or cards with a single accent border line down one
side.