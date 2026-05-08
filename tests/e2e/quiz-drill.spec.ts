import { expect, test } from '@playwright/test'

import { QUESTIONS } from '../../src/data/questions'
import { currentQuestionId, practiceStat } from './helpers'

test('quiz mode allows answering and moving to next question', async ({ page }) => {
  await page.goto('/')

  // Quiz mode should be reachable directly from the global navigation.
  await page.getByRole('button', { name: 'Quiz' }).click()
  await expect(page.locator('section[aria-label="quiz stats"]')).toBeVisible()

  // Answer once so feedback appears and the current question is considered completed.
  const firstChoice = page.locator('.choices button').first()
  await firstChoice.click()
  await expect(page.locator('.ok, .bad')).toBeVisible()

  // Next question should clear the previous feedback and load a fresh prompt.
  await page.getByRole('button', { name: 'Next quiz question' }).click()
  await expect(page.locator('.ok, .bad')).toHaveCount(0)
})

test('quiz correct answers mark questions as known and avoid adding drill items', async ({ page }) => {
  const questionsById = new Map(QUESTIONS.map((question) => [question.id, question]))

  await page.goto('/')
  await page.getByRole('button', { name: 'Quiz' }).click()

  // Read the active question so we can intentionally pick a correct answer choice.
  const qid = await currentQuestionId(page)
  const question = questionsById.get(qid)
  expect(question).toBeDefined()

  const choices = page.locator('.choices button')
  const choiceCount = await choices.count()
  let correctChoiceIndex = -1

  for (let i = 0; i < choiceCount; i += 1) {
    const label = (await choices.nth(i).textContent())?.trim() ?? ''
    if (question!.answers.includes(label)) {
      correctChoiceIndex = i
      break
    }
  }

  expect(correctChoiceIndex).toBeGreaterThanOrEqual(0)

  // A correct submission should show success feedback.
  await choices.nth(correctChoiceIndex).click()
  await expect(page.locator('.ok')).toBeVisible()

  // Move back to flashcards to validate the shared rating state was updated to known.
  await page.getByRole('button', { name: 'Flashcards' }).click()
  await expect(practiceStat(page, 'Known')).toHaveText('1')

  // Correct quiz answers should not create drill backlog.
  await expect(page.getByRole('button', { name: 'Drill (0)' })).toBeVisible()
})

test('quiz misses feed drill mode and drill can be cleared', async ({ page }) => {
  const questionsById = new Map(QUESTIONS.map((question) => [question.id, question]))

  await page.goto('/')
  await page.getByRole('button', { name: 'Quiz' }).click()
  await expect(page.locator('section[aria-label="quiz stats"]')).toBeVisible()

  // Capture the active quiz question so we can later confirm drill mode contains it.
  const qid = await currentQuestionId(page)
  const question = questionsById.get(qid)
  expect(question).toBeDefined()

  const choices = page.locator('.choices button')
  const choiceCount = await choices.count()
  let wrongChoiceIndex = -1

  for (let i = 0; i < choiceCount; i += 1) {
    const label = (await choices.nth(i).textContent())?.trim() ?? ''
    if (!question!.answers.includes(label)) {
      wrongChoiceIndex = i
      break
    }
  }

  expect(wrongChoiceIndex).toBeGreaterThanOrEqual(0)

  // Submit a known-wrong answer so the app should add this card to the drill list.
  await choices.nth(wrongChoiceIndex).click()
  await expect(page.locator('.bad')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Practice missed (1)' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Drill (1)' })).toBeVisible()

  // Jump directly into drill mode from the quiz CTA and confirm the same question is present.
  await page.getByRole('button', { name: 'Practice missed (1)' }).click()
  await expect(page.getByRole('heading', { name: 'Missed-question drill' })).toBeVisible()
  expect(await currentQuestionId(page)).toBe(qid)
  await expect(practiceStat(page, 'Needs review')).toHaveText('1')

  // Clearing drill should reset the backlog and return the user to standard flashcards.
  await page.getByRole('button', { name: 'Clear missed list' }).click()
  await expect(page.getByRole('heading', { name: 'Flashcard practice' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Drill (0)' })).toBeVisible()
})
