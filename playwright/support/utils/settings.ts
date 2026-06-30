import { expect, type Page } from '@playwright/test'
import type { Entries } from 'type-fest'

import type { FieldConfig, UserSettings } from '../../../shared/schema'
import { Selectors } from '../constants'
import type { RequestCounts } from '../fixtures'
import { getSettings } from './api'

const { Menu, Settings } = Selectors

async function getCheckedState(page: Page, selector: string): Promise<boolean> {
  const state = await page.locator(selector).getAttribute('data-state')
  if (state === 'checked') return true
  if (state === 'unchecked') return false
  throw new Error(`Element ${selector} does not have a data-state attribute`)
}

async function toggleState(
  page: Page,
  selector: string,
  newState: boolean,
): Promise<void> {
  const current = await getCheckedState(page, selector)
  expect(current, `expected current state to be ${!newState}`).toBe(!newState)
  await page.locator(selector).click()
  await expect(page.locator(selector)).toHaveAttribute(
    'data-state',
    newState ? 'checked' : 'unchecked',
  )
}

async function maybeWaitForSettingsUpdate(
  page: Page,
  isLoggedIn: boolean,
  tracker: RequestCounts,
): Promise<void> {
  if (!isLoggedIn) return
  const expected = tracker.updateSettings + 1
  await expect(() => {
    expect(tracker.updateSettings).toBeGreaterThanOrEqual(expected)
  }).toPass({ timeout: 5000 })
}

async function setFieldConfig(
  page: Page,
  isLoggedIn: boolean,
  tracker: RequestCounts,
  targetConfig: FieldConfig,
): Promise<void> {
  for (const [field, { visible, required }] of Object.entries(
    targetConfig,
  ) as Entries<FieldConfig>) {
    const visibleSel = Settings.FieldConfig.visibleCheckbox(field)
    const requiredSel = Settings.FieldConfig.requiredCheckbox(field)

    const isVisible = await getCheckedState(page, visibleSel)
    if (isVisible !== visible) {
      await toggleState(page, visibleSel, visible)
      await maybeWaitForSettingsUpdate(page, isLoggedIn, tracker)
    }

    const isRequired = await getCheckedState(page, requiredSel)
    if (isRequired !== required) {
      await toggleState(page, requiredSel, required)
      await maybeWaitForSettingsUpdate(page, isLoggedIn, tracker)
    }
  }
}

export async function setSettings(
  page: Page,
  isLoggedIn: boolean,
  tracker: RequestCounts,
  settings: Pick<UserSettings, 'fieldConfig'>,
): Promise<void> {
  await page.locator(Selectors.MENU_BTN).click()
  await page.locator(Menu.SETTINGS).click()

  await setFieldConfig(page, isLoggedIn, tracker, settings.fieldConfig)

  if (isLoggedIn) {
    const current = await getSettings(page)
    expect(current).toMatchObject(settings)
  }
}

export function getCheckedStateOf(
  page: Page,
  selector: string,
): Promise<boolean> {
  return getCheckedState(page, selector)
}

export function toggleStateOf(
  page: Page,
  selector: string,
  newState: boolean,
): Promise<void> {
  return toggleState(page, selector, newState)
}
