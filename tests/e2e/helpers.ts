import { expect, type Page } from '@playwright/test'

export function extractQuestionId(rawId: string | null) {
  if (!rawId) return null
  const id = Number(rawId)
  return Number.isFinite(id) ? id : null
}

export function practiceStat(page: Page, label: string) {
  return page
    .locator('section[aria-label="practice stats"] div')
    .filter({ hasText: label })
    .locator('strong')
}

export function interviewStat(page: Page, label: string) {
  return page
    .locator('section[aria-label="interview stats"] div')
    .filter({ hasText: label })
    .locator('strong')
}

export function categoryCard(page: Page, category: string) {
  return page
    .locator('section[aria-label="category progress"] article')
    .filter({ has: page.getByRole('heading', { level: 3, name: category, exact: true }) })
}

export async function currentQuestionId(page: Page) {
  const meta = page.locator('.question-card [data-question-id]').first()
  await expect(meta).toBeVisible()

  const qid = extractQuestionId(await meta.getAttribute('data-question-id'))
  expect(qid).not.toBeNull()
  return qid as number
}
