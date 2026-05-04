# Implementation Details Log

## 2026-05-04

### Infrastructure
- Installed dependencies with `pnpm`.
- Configured Vite dev server in `vite.config.ts` to run on:
  - host: `0.0.0.0`
  - port: `1776`
  - strictPort: `true`
- Dev server is intended to stay running in background for continuous HMR testing.

### Milestone 1 — Practice Deck
- Replaced default starter UI with practice-focused civics flashcards.
- Added:
  - random navigation
  - reveal/hide answer
  - known/review rating
  - all/unrated/review filtering
  - category progress cards
  - localStorage persistence
  - keyboard shortcuts (`R`, `N`, `1`, `2`)

### Milestone 1.1 — Full Question Bank + Interview
- Expanded to full 100 USCIS civics questions in `src/data/questions.ts`.
- Added mock interview mode:
  - 10 unique randomized questions
  - self-scoring
  - pass/fail summary (6+ correct to pass)

### Milestone 2 — Quiz + Streak + Missed Drill
- Added multiple-choice quiz mode with automatic grading.
- Added quiz stats:
  - current streak
  - best streak
  - accuracy
  - running session timer
- Added missed-question tracking from wrong quiz answers.
- Added drill mode to focus only on missed questions.

### Milestone 3 — Print + Dynamic Placeholders + A11y + Tests
- Added printable study sheet (`window.print`) with print-only layout.
- Added state/profile placeholders workflow in Settings mode:
  - state capital, governor, senators, representative
  - president, vice president, speaker
- Dynamic answers are merged into applicable variable questions.
- Accessibility improvements:
  - skip link
  - keyboard mode switching
  - visible focus styles
  - semantic landmarks/labels
- Added lightweight unit tests for quiz helpers with Vitest.

### Milestone 4 — Backup/Import + PWA + QA Checklist
- Added export/import JSON backup (account-free):
  - ratings
  - user profile
  - missed-question list
- Added PWA install support:
  - `public/manifest.webmanifest`
  - `public/sw.js`
  - service worker registration in `src/main.tsx`
  - app icons (`public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`)
- Added final QA checklist in `QA_CHECKLIST.md`.

### Cleanup
- Removed unused template/static assets to keep the project lightweight:
  - removed unused `public/icons.svg`
  - removed unused `src/assets/*` files

### New Files
- `PLAN.md`
- `IMPLEMENTATION_DETAILS.md`
- `QA_CHECKLIST.md`
- `src/data/questions.ts`
- `src/lib/quiz.ts`
- `src/lib/quiz.test.ts`
- `public/manifest.webmanifest`
- `public/sw.js`
- `public/app-icon.svg`
- `public/icon-192.png`
- `public/icon-512.png`
- `public/apple-touch-icon.png`

### Updated Files
- `vite.config.ts`
- `src/App.tsx`
- `src/App.css`
- `src/index.css`
- `src/main.tsx`
- `index.html`
- `package.json`

### Validation
- Run:
  - `pnpm test`
  - `pnpm build`
  - `pnpm lint` (optional cleanup pass)
