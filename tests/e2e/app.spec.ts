import { expect, test } from '@playwright/test'

test('flashcards mode supports reveal/rate and guide toggle', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'U.S. Citizenship Test Practice' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Flashcard practice' })).toBeVisible()

  await page.getByRole('button', { name: 'Hide guide' }).click()
  await expect(page.getByRole('button', { name: 'Show guide' })).toBeVisible()

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

test('settings warning appears when required fields are missing and clears once filled', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('Before you start, complete required Settings fields:')).toBeVisible()
  await page.getByRole('button', { name: 'Go to Settings' }).click()

  await page.getByLabel('State', { exact: true }).fill('California')
  await page.getByLabel('State capital', { exact: true }).fill('Sacramento')
  await page.getByLabel('Governor', { exact: true }).fill('Gavin Newsom')
  await page.getByLabel('Senator 1', { exact: true }).fill('Alex Padilla')
  await page.getByLabel('Senator 2', { exact: true }).fill('Laphonza Butler')
  await page.getByLabel('Representative', { exact: true }).fill('Nancy Pelosi')

  await page.getByRole('button', { name: 'Flashcards' }).click()
  await expect(page.getByText('Before you start, complete required Settings fields:')).toHaveCount(0)
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
