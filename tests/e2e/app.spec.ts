import { expect, test } from '@playwright/test'

function extractQuestionId(rawId: string | null) {
  if (!rawId) return null
  const id = Number(rawId)
  return Number.isFinite(id) ? id : null
}

test('flashcards mode supports reveal/rate and guide toggle', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'U.S. Citizenship Test Practice' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Flashcard practice' })).toBeVisible()

  await page.getByRole('button', { name: 'Hide guide' }).click()
  await expect(page.getByRole('button', { name: 'Show guide' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Show guide' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hide guide' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Show guide' }).click()
  await expect(page.getByRole('heading', { name: 'Flashcard practice' })).toBeVisible()

  await page.getByRole('button', { name: /Reveal answer \(R\)|Reveal/ }).first().click()
  await expect(page.getByText('Accepted answer(s)')).toBeVisible()

  await page.getByRole('button', { name: /I knew this \(1\)|Known/ }).first().click()

  const knownStat = page
    .locator('section[aria-label="practice stats"] div')
    .filter({ hasText: 'Known' })
    .locator('strong')
  await expect(knownStat).toHaveText('1')
})

test('settings warning badge appears when required fields are missing and clears once filled', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Settings (required fields missing)' })).toBeVisible()
  await expect(page.getByText('Before you start, complete required Settings fields:')).toBeVisible()

  await page.getByRole('button', { name: 'Go to Settings' }).click()
  await page.locator('#state-select').selectOption('CA')
  await page.getByLabel(/Representative/).first().fill('Nancy Pelosi')

  await expect(page.getByRole('button', { name: 'Settings (required fields missing)' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()

  await page.getByRole('button', { name: 'Flashcards' }).click()
  await expect(page.getByText('Before you start, complete required Settings fields:')).toHaveCount(0)
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

  for (let i = 0; i < 100; i += 1) {
    const meta = page.locator('.question-card [data-question-id]').first()
    await expect(meta).toBeVisible()
    const qid = extractQuestionId(await meta.getAttribute('data-question-id'))
    expect(qid).not.toBeNull()
    seenIds.add(qid as number)

    const markingActions = page.locator('section.study-actions').nth(1)

    if (i < 40) {
      await markingActions.getByRole('button', { name: 'I knew this (1)' }).click()
    } else {
      await markingActions.getByRole('button', { name: 'Needs review (2)' }).click()
    }
  }

  expect(seenIds.size).toBe(100)

  const knownStat = page
    .locator('section[aria-label="practice stats"] div')
    .filter({ hasText: 'Known' })
    .locator('strong')
  const reviewStat = page
    .locator('section[aria-label="practice stats"] div')
    .filter({ hasText: 'Needs review' })
    .locator('strong')
  const progressStat = page
    .locator('section[aria-label="practice stats"] div')
    .filter({ hasText: 'Progress' })
    .locator('strong')

  await expect(knownStat).toHaveText('40')
  await expect(reviewStat).toHaveText('60')
  await expect(progressStat).toHaveText('100%')
})

test('quiz mode allows answering and moving to next question', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Quiz' }).click()
  await expect(page.locator('section[aria-label="quiz stats"]')).toBeVisible()

  const firstChoice = page.locator('.choices button').first()
  await firstChoice.click()

  await expect(page.locator('.ok, .bad')).toBeVisible()

  await page.getByRole('button', { name: 'Next quiz question' }).click()
  await expect(page.locator('.ok, .bad')).toHaveCount(0)
})
