# Final QA & Deployment Checklist

## Functional QA
- [ ] Practice mode: reveal/hide, rate known/review, filters
- [ ] Interview mode: 10 questions, scoring, pass/fail summary
- [ ] Quiz mode: multiple-choice auto grading, streak, accuracy, timer
- [ ] Drill mode: missed list generated and can be cleared
- [ ] State profile answers appear in variable-answer questions
- [ ] Backup export and import restores state
- [ ] Print sheet renders all questions/answers in print layout

## Technical QA
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [ ] Dev server HMR works on port 1776
- [ ] Manifest is valid and install prompt appears on supported browsers
- [ ] Service worker registers without errors

## Accessibility QA
- [ ] Keyboard-only flow works across all modes
- [ ] Focus visible for all controls
- [ ] Skip link works
- [ ] Landmarks and labels are present

## Release
- [ ] Version/tag update
- [ ] Changelog notes
- [ ] Deploy
