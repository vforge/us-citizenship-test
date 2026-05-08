import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

import { STATE_OFFICIALS_BY_ABBR } from '../../src/data/state-officials'
import { practiceStat } from './helpers'

test('settings warning badge appears when required fields are missing and clears once filled', async ({ page }) => {
  await page.goto('/')

  // The app should guide a first-time user toward the required state-specific fields.
  await expect(page.getByRole('button', { name: 'Settings (required fields missing)' })).toBeVisible()
  await expect(page.getByText('Before you start, complete required Settings fields:')).toBeVisible()

  // Selecting a state should auto-fill most required values from local reference data.
  await page.getByRole('button', { name: 'Go to Settings' }).click()
  await page.locator('#state-select').selectOption('CA')

  // Representative remains district-specific, so fill it manually to complete the profile.
  await page.getByLabel(/Representative/).first().fill('Nancy Pelosi')

  // Once every required field is present, the warning state should disappear.
  await expect(page.getByRole('button', { name: 'Settings (required fields missing)' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()

  // Returning to flashcards should no longer show the blocking guide warning.
  await page.getByRole('button', { name: 'Flashcards' }).click()
  await expect(page.getByText('Before you start, complete required Settings fields:')).toHaveCount(0)
})

test('settings auto-fill, export, and import cover profile and progress data', async ({ page }) => {
  const california = STATE_OFFICIALS_BY_ABBR.CA

  // Mock ZIP lookup so the test stays deterministic and independent from the external API.
  await page.route('https://api.zippopotam.us/us/94110', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        places: [
          {
            state: california.state,
            'state abbreviation': 'CA',
          },
        ],
      }),
    })
  })

  await page.goto('/')

  // Seed a little study data so the export contains both profile and progress information.
  await page.getByRole('button', { name: /I knew this \(1\)|Known/ }).first().click()
  await expect(practiceStat(page, 'Known')).toHaveText('1')

  // Go to Settings and use ZIP auto-fill for the state-specific fields.
  await page.getByRole('button', { name: 'Settings (required fields missing)' }).click()
  await page.locator('#zip-input').fill('94110')
  await page.getByRole('button', { name: 'Auto-fill from ZIP' }).click()

  const profileForm = page.locator('.profile-grid')

  // Verify the ZIP lookup populated the local profile fields with the expected values.
  await expect(page.locator('.zip-status')).toHaveText(`Auto-filled profile for ${california.state}.`)
  await expect(profileForm.getByRole('textbox', { name: 'State', exact: true })).toHaveValue(
    california.state,
  )
  await expect(profileForm.getByLabel('State capital')).toHaveValue(california.stateCapital)
  await expect(profileForm.getByLabel('Governor')).toHaveValue(california.governor)
  await expect(profileForm.getByLabel('Senator 1')).toHaveValue(california.senators[0])
  await expect(profileForm.getByLabel('Senator 2')).toHaveValue(california.senators[1])

  // Representative still needs manual district-specific data.
  await page.getByLabel(/Representative/).first().fill('Nancy Pelosi')

  // Export the backup and inspect the file contents directly.
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON backup' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('us-citizenship-test-backup.json')

  const downloadPath = await download.path()
  expect(downloadPath).not.toBeNull()
  const exported = JSON.parse(await readFile(downloadPath!, 'utf8')) as {
    ratings: Record<string, 'known' | 'review'>
    profile: {
      state?: string
      stateCapital?: string
      governor?: string
      senator1?: string
      senator2?: string
      representative?: string
    }
    missedQuestionIds: number[]
  }

  // The backup should contain both the study progress and the personalized settings.
  expect(Object.values(exported.ratings)).toContain('known')
  expect(exported.profile).toMatchObject({
    state: california.state,
    stateCapital: california.stateCapital,
    governor: california.governor,
    senator1: california.senators[0],
    senator2: california.senators[1],
    representative: 'Nancy Pelosi',
  })

  // Import a different backup to prove restore works end-to-end through the hidden file input.
  await page.locator('input[type="file"]').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        ratings: { 1: 'review', 2: 'known' },
        profile: {
          state: 'New York',
          stateCapital: 'Albany',
          governor: 'Kathy Hochul',
          senator1: 'Chuck Schumer',
          senator2: 'Kirsten Gillibrand',
          representative: 'Test Representative',
        },
        missedQuestionIds: [1],
      }),
    ),
  })

  // The form should immediately reflect the imported profile.
  await expect(profileForm.getByRole('textbox', { name: 'State', exact: true })).toHaveValue(
    'New York',
  )
  await expect(profileForm.getByLabel('State capital')).toHaveValue('Albany')
  await expect(profileForm.getByLabel('Governor')).toHaveValue('Kathy Hochul')
  await expect(profileForm.getByLabel('Senator 1')).toHaveValue('Chuck Schumer')
  await expect(profileForm.getByLabel('Senator 2')).toHaveValue('Kirsten Gillibrand')
  await expect(page.getByLabel(/Representative/).first()).toHaveValue('Test Representative')

  // Return to flashcards and confirm the imported progress state also took effect.
  await page.getByRole('button', { name: 'Flashcards' }).click()
  await expect(practiceStat(page, 'Known')).toHaveText('1')
  await expect(practiceStat(page, 'Needs review')).toHaveText('1')
  await expect(page.getByRole('button', { name: 'Drill (1)' })).toBeVisible()
})
