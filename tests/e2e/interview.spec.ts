import { expect, test } from '@playwright/test'

import { interviewStat } from './helpers'

test('interview mode completes a 10-question session and shows pass status', async ({ page }) => {
  await page.goto('/')

  // Enter interview mode through the same top-level navigation a real learner uses.
  await page.getByRole('button', { name: 'Interview' }).click()
  await expect(page.getByRole('heading', { name: 'Mock interview' })).toBeVisible()
  await expect(interviewStat(page, 'Status')).toHaveText('In progress')

  for (let i = 0; i < 10; i += 1) {
    // Interview mode is reveal-then-self-score, so always reveal before scoring.
    await page.getByRole('button', { name: 'Reveal answer' }).click()

    // Score the first 6 as correct so the run finishes with a passing result.
    if (i < 6) {
      await page.getByRole('button', { name: 'Correct' }).click()
    } else {
      await page.getByRole('button', { name: 'Missed' }).click()
    }
  }

  // The final summary should reflect both the score and the pass/fail status.
  await expect(page.getByText('Interview complete')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'You got 6 / 10' })).toBeVisible()
  await expect(interviewStat(page, 'Correct')).toHaveText('6')
  await expect(interviewStat(page, 'Status')).toHaveText('Pass')

  // Restart should immediately bring the learner back to a fresh in-progress session.
  await page.getByRole('button', { name: 'Restart interview' }).click()
  await expect(interviewStat(page, 'Status')).toHaveText('In progress')
})
