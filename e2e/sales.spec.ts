/**
 * e2e/sales.spec.ts  (task 16)
 * Smoke test of the golden "Sales total" séance and the landing CTA.
 * Replay only: clicking the chip plays the cached fixture, so no Groq call is
 * made. Validates: Requirements 2.2, 7.2
 */
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Fails the test on the first console error or uncaught page error. */
function failOnConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push(err.message))
  return errors
}

test('the sales golden séance replays and both runs agree', async ({ page }) => {
  const errors = failOnConsoleErrors(page)

  await page.goto('/seance')

  // Empty state is shown; the four suggestion chips are the golden replays (Req 2.2).
  await expect(page.getByRole('button', { name: 'Total the sales in a CSV' })).toBeVisible()
  await page.getByRole('button', { name: 'Total the sales in a CSV' }).click()

  // The proof moment (Req 7.2): Python agrees and both print 5871.50.
  await expect(page.getByText('Python agrees.')).toBeVisible()
  await expect(page.getByText('Both runs print 5871.50.')).toBeVisible()

  // All three panes rendered.
  const cobol = page.getByRole('region', { name: 'COBOL program' })
  await expect(cobol).toBeVisible()
  await expect(cobol).toContainText('IDENTIFICATION DIVISION')

  // The ghost's first step, read from the fixture so the check can't drift.
  const first = (JSON.parse(readFileSync('src/fixtures/golden/sales.json', 'utf8')) as {
    narration: { steps: { range: [number, number]; quote?: string; text: string }[] }
  }).narration.steps[0]
  const ghost = page.getByRole('region', { name: "The ghost's explanation" })
  await expect(ghost).toBeVisible()
  await expect(ghost).toContainText(`LINES ${first.range[0]}–${first.range[1]}`)
  await expect(ghost).toContainText(first.text)
  if (first.quote) await expect(ghost).toContainText(first.quote)

  const python = page.getByRole('region', { name: 'Python translation' })
  await expect(python).toBeVisible()
  await expect(python).toContainText('import sys')

  // The output pane shows the real result line.
  await expect(page.getByRole('log', { name: 'Program output' })).toContainText('TOTAL SALES:')

  expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([])
})

test('the landing CTA leads to the workspace', async ({ page }) => {
  const errors = failOnConsoleErrors(page)

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('1959')

  // Any "Begin a séance" CTA points at /seance; follow the first one.
  const cta = page.getByRole('link', { name: 'Begin a séance' }).first()
  await expect(cta).toHaveAttribute('href', '/seance')
  await cta.click()

  await expect(page).toHaveURL(/\/seance\/?$/)
  await expect(page.getByText('The candles are lit.')).toBeVisible()

  expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([])
})
