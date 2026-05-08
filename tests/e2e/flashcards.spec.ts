import { expect, test } from '@playwright/test'

import { currentQuestionId, practiceStat } from './helpers'

test('flashcards mode supports guide toggle, reveal/rate, and persisted progress', async ({ page }) => {
  await page.goto('/')

  // Start by asserting the primary flashcards view is the first thing a learner sees.
  await expect(page.getByRole('heading', { name: 'U.S. Citizenship Test Practice' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Flashcard practice' })).toBeVisible()

  // The help guide should be hideable for repeat usage.
  await page.getByRole('button', { name: 'Hide guide' }).click()
  await expect(page.getByRole('button', { name: 'Show guide' })).toBeVisible()

  // The guide preference is intentionally persisted in local storage.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Show guide' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hide guide' })).toHaveCount(0)

  // Re-open the guide so we are back in the default learning flow.
  await page.getByRole('button', { name: 'Show guide' }).click()
  await expect(page.getByRole('heading', { name: 'Flashcard practice' })).toBeVisible()

  // A learner should be able to reveal the answer before self-rating.
  await page.getByRole('button', { name: /Reveal answer \(R\)|Reveal/ }).first().click()
  await expect(page.getByText('Accepted answer(s)')).toBeVisible()

  // Rating the card as known should immediately update the flashcard stats.
  await page.getByRole('button', { name: /I knew this \(1\)|Known/ }).first().click()
  await expect(practiceStat(page, 'Known')).toHaveText('1')

  // Progress should persist across reloads so a study session survives refreshes.
  await page.reload()
  await expect(practiceStat(page, 'Known')).toHaveText('1')
})

test('flashcard filters and reset progress keep deck state consistent', async ({ page }, testInfo) => {
  await page.goto('/')

  const useMobileBar = testInfo.project.name === 'mobile-chrome'

  // Always start this test from a clean slate so filter counts are deterministic.
  await page.getByRole('button', { name: 'Reset progress' }).click()
  await expect(practiceStat(page, 'Known')).toHaveText('0')
  await expect(practiceStat(page, 'Needs review')).toHaveText('0')

  // Mark one card for review so the Review filter has exactly one item.
  const reviewQuestionId = await currentQuestionId(page)
  if (useMobileBar) {
    await page.locator('section[aria-label="quick study actions"]').getByRole('button', { name: 'Review' }).click()
  } else {
    await page.getByRole('button', { name: 'Needs review (2)' }).click()
  }
  await expect(practiceStat(page, 'Needs review')).toHaveText('1')

  // Mark another card as known so we also have a rated-known item in the session.
  const knownQuestionId = await currentQuestionId(page)
  if (useMobileBar) {
    await page.locator('section[aria-label="quick study actions"]').getByRole('button', { name: 'Known' }).click()
  } else {
    await page.getByRole('button', { name: 'I knew this (1)' }).click()
  }
  await expect(practiceStat(page, 'Known')).toHaveText('1')

  // The Review filter should now isolate the one card we explicitly marked for review.
  await page.getByRole('button', { name: 'Review (1)' }).click()
  expect(await currentQuestionId(page)).toBe(reviewQuestionId)

  // The Unrated filter should exclude the two cards we already touched.
  await page.getByRole('button', { name: 'Unrated (98)' }).click()
  const unratedQuestionId = await currentQuestionId(page)
  expect(unratedQuestionId).not.toBe(reviewQuestionId)
  expect(unratedQuestionId).not.toBe(knownQuestionId)

  // Reset should wipe counters, attempts, and filter-derived counts in one action.
  await page.getByRole('button', { name: 'Reset progress' }).click()
  await expect(practiceStat(page, 'Known')).toHaveText('0')
  await expect(practiceStat(page, 'Needs review')).toHaveText('0')
  await expect(practiceStat(page, 'Progress')).toHaveText('0%')
  await expect(practiceStat(page, 'Attempts')).toHaveText('0')
  await expect(page.getByRole('button', { name: 'All (100)' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unrated (100)' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Review (0)' })).toBeVisible()
})

test('print study guide button triggers browser print', async ({ page }) => {
  // Stub window.print so we can assert the button requests printing without opening dialogs.
  await page.addInitScript(() => {
    const testWindow = window as Window & { __printCount?: number }
    testWindow.__printCount = 0
    window.print = () => {
      testWindow.__printCount = (testWindow.__printCount ?? 0) + 1
    }
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Print study guide' }).click()

  // Poll the browser-side counter because print is triggered inside the page context.
  await expect
    .poll(() => page.evaluate(() => (window as Window & { __printCount?: number }).__printCount ?? 0))
    .toBe(1)
})

