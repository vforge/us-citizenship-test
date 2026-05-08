import { expect, test } from '@playwright/test'

import { practiceStat } from './helpers'

test('mobile quick study bar supports reveal and rating actions', async ({ page }) => {
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
