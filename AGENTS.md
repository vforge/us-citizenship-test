# AGENTS.md

This file provides lightweight operator notes for AI/code agents working in this repository.

## Project-specific notes (not documented elsewhere)

- The app intentionally keeps a "human-in-the-loop" model for civics correctness. It is acceptable to prefer clarity and easy correction over complex auto-grading heuristics.
- For copy/disclaimer edits, preserve the author voice in README and footer (personal/internal-tool origin + open-source sharing intent).
- If UX tradeoffs are needed, prioritize:
  1. mobile one-hand usability,
  2. accessibility feedback (aria-live/status),
  3. low visual clutter.
- When changing question data behavior, avoid silently removing existing accepted answers; add/annotate instead.

## Safe change policy

- Do not remove USCIS verification references from README/footer.
- Do not change deploy branch assumptions (`master`) unless explicitly requested.
- Keep dev server default port as `1776`.
