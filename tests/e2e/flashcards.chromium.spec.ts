import { expect, test } from '@playwright/test'

import { QUESTIONS } from '../../src/data/questions'
import { categoryCard, currentQuestionId, practiceStat } from './helpers'

test('flashcard keyboard shortcuts switch modes and control practice flow', async ({ page }) => {
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

test('flashcard shuffled sequence covers all cards and counting is accurate', async ({ page }) => {
  test.setTimeout(120_000)

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

test('flashcard category counters stay in sync for every rated question', async ({ page }) => {
  test.setTimeout(120_000)

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
