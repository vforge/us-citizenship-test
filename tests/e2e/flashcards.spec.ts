import { expect, test } from '@playwright/test'

import { QUESTIONS } from '../../src/data/questions'
import { categoryCard, currentQuestionId, practiceStat } from './helpers'

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

test('flashcard keyboard shortcuts switch modes and control practice flow', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'chromium') test.skip()

  await page.goto('/')

  // Click the main app surface first so subsequent key presses are delivered to the page.
  await page.locator('main.app').click()

  // Keyboard shortcuts are a desktop-oriented feature, so validate them in chromium.
  await page.keyboard.press('q')
  await expect(page.getByRole('heading', { name: 'Multiple-choice quiz' })).toBeVisible()

  // Move back to practice mode before testing flashcard-specific actions.
  await page.keyboard.press('p')
  await expect(page.getByRole('heading', { name: 'Flashcard practice' })).toBeVisible()

  // Capture the current card so we can confirm the next-card shortcut actually advances.
  const firstQuestionId = await currentQuestionId(page)

  // Reveal with the keyboard shortcut instead of the mouse.
  await page.keyboard.press('r')
  await expect(page.getByText('Accepted answer(s)')).toBeVisible()

  // Advance with the next-card shortcut and confirm the active card changed.
  await page.keyboard.press('n')
  expect(await currentQuestionId(page)).not.toBe(firstQuestionId)

  // Rate the new card with the numeric shortcut.
  await page.keyboard.press('2')
  await expect(practiceStat(page, 'Needs review')).toHaveText('1')

  // Mode switching shortcuts should continue to work after practice interactions.
  await page.keyboard.press('i')
  await expect(page.getByRole('heading', { name: 'Mock interview', exact: true })).toBeVisible()
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

test('mobile quick study bar supports reveal and rating actions', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile-chrome') test.skip()

  await page.goto('/')

  // On small screens the sticky quick bar replaces the larger desktop action rows.
  const quickBar = page.locator('section[aria-label="quick study actions"]')
  await expect(quickBar).toBeVisible()

  // Make sure the compact controls still expose the same study behavior.
  await quickBar.getByRole('button', { name: 'Reveal' }).click()
  await expect(page.getByText('Accepted answer(s)')).toBeVisible()

  await quickBar.getByRole('button', { name: 'Known' }).click()
  await expect(practiceStat(page, 'Known')).toHaveText('1')
})

test('flashcard shuffled sequence covers all cards and counting is accurate', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  if (testInfo.project.name !== 'chromium') test.skip()

  await page.goto('/')
  await page.getByRole('button', { name: 'Flashcards' }).click()
  await page.getByRole('button', { name: 'All (100)' }).click()
  await page.getByRole('button', { name: 'Reset progress' }).click()
  await page.getByRole('button', { name: 'Shuffle deck' }).click()

  const seenIds = new Set<number>()

  for (let i = 0; i < QUESTIONS.length; i += 1) {
    // Read the active question id directly from the card metadata.
    const qid = await currentQuestionId(page)
    seenIds.add(qid)

    // Rate the first 40 as known and the rest as review so final counters are predictable.
    const markingActions = page.locator('section.study-actions').nth(1)
    if (i < 40) {
      await markingActions.getByRole('button', { name: 'I knew this (1)' }).click()
    } else {
      await markingActions.getByRole('button', { name: 'Needs review (2)' }).click()
    }
  }

  // The shuffled deck should still surface every question exactly once across the full pass.
  expect(seenIds.size).toBe(QUESTIONS.length)
  await expect(practiceStat(page, 'Known')).toHaveText('40')
  await expect(practiceStat(page, 'Needs review')).toHaveText('60')
  await expect(practiceStat(page, 'Progress')).toHaveText('100%')
})

test('flashcard category counters stay in sync for every rated question', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  if (testInfo.project.name !== 'chromium') test.skip()

  // Build an in-memory expectation model so every UI assertion compares against known totals.
  const questionsById = new Map(QUESTIONS.map((question) => [question.id, question]))
  const expectedByCategory = new Map<string, { total: number; known: number; review: number }>()

  for (const question of QUESTIONS) {
    const current = expectedByCategory.get(question.category) ?? {
      total: 0,
      known: 0,
      review: 0,
    }

    current.total += 1
    expectedByCategory.set(question.category, current)
  }

  await page.goto('/')
  await page.getByRole('button', { name: 'Flashcards' }).click()
  await page.getByRole('button', { name: 'All (100)' }).click()
  await page.getByRole('button', { name: 'Reset progress' }).click()
  await page.getByRole('button', { name: 'Shuffle deck' }).click()

  let expectedKnownCount = 0
  let expectedReviewCount = 0
  let expectedAttemptCount = 0
  const seenIds = new Set<number>()

  for (let i = 0; i < QUESTIONS.length; i += 1) {
    // Track the exact card we are rating so the per-category expectation stays aligned.
    const qid = await currentQuestionId(page)
    seenIds.add(qid)

    const question = questionsById.get(qid)
    expect(question).toBeDefined()

    const stats = expectedByCategory.get(question!.category)
    expect(stats).toBeDefined()

    // Alternate known/review using a deterministic pattern based on the question id.
    const markingActions = page.locator('section.study-actions').nth(1)
    const shouldMarkKnown = qid % 2 === 1

    if (shouldMarkKnown) {
      expectedKnownCount += 1
      stats!.known += 1
      await markingActions.getByRole('button', { name: 'I knew this (1)' }).click()
    } else {
      expectedReviewCount += 1
      stats!.review += 1
      await markingActions.getByRole('button', { name: 'Needs review (2)' }).click()
    }

    expectedAttemptCount += 1

    // First verify the global counters update immediately.
    await expect(practiceStat(page, 'Known')).toHaveText(String(expectedKnownCount))
    await expect(practiceStat(page, 'Needs review')).toHaveText(String(expectedReviewCount))
    await expect(practiceStat(page, 'Attempts')).toHaveText(String(expectedAttemptCount))

    // Then verify the specific category card for the just-rated question also updates.
    const currentCategoryCard = categoryCard(page, question!.category)
    await expect(currentCategoryCard.locator('.category-stats-inline strong').nth(0)).toHaveText(
      `${stats!.known}/${stats!.total}`,
    )
    await expect(currentCategoryCard.locator('.category-stats-inline strong').nth(1)).toHaveText(
      String(stats!.review),
    )
  }

  // Confirm the run really covered the full question bank before checking final totals.
  expect(seenIds.size).toBe(QUESTIONS.length)
  await expect(practiceStat(page, 'Known')).toHaveText(String(expectedKnownCount))
  await expect(practiceStat(page, 'Needs review')).toHaveText(String(expectedReviewCount))
  await expect(practiceStat(page, 'Progress')).toHaveText('100%')
  await expect(practiceStat(page, 'Attempts')).toHaveText(String(QUESTIONS.length))

  // Finally, assert every category card ended at the exact modeled totals.
  for (const [category, stats] of expectedByCategory) {
    const currentCategoryCard = categoryCard(page, category)
    await expect(currentCategoryCard.locator('.category-stats-inline strong').nth(0)).toHaveText(
      `${stats.known}/${stats.total}`,
    )
    await expect(currentCategoryCard.locator('.category-stats-inline strong').nth(1)).toHaveText(
      String(stats.review),
    )
  }
})
