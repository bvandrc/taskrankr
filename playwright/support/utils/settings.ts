import { expect } from '@playwright/test'
import type { Entries } from 'type-fest'

import type { FieldConfig, UserSettings } from '../../../shared/schema'
import { Selectors } from '../constants'
import type { RequestCounts } from '../fixtures'
import { getPage } from '../page-context'
import { getSettings } from './api'

const { Menu, Settings } = Selectors

async function getCheckedState(selector: string): Promise<boolean> {
  const state = await getPage().locator(selector).getAttribute('data-state')
  if (state === 'checked') return true
  if (state === 'unchecked') return false
  throw new Error(`Element ${selector} does not have a data-state attribute`)
}

async function toggleState(selector: string, newState: boolean): Promise<void> {
  const current = await getCheckedState(selector)
  expect(current, `expected current state to be ${!newState}`).toBe(!newState)
  await getPage().locator(selector).click()
  await expect(getPage().locator(selector)).toHaveAttribute(
    'data-state',
    newState ? 'checked' : 'unchecked',
  )
}

async function maybeWaitForSettingsUpdate(
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
  isLoggedIn: boolean,
  tracker: RequestCounts,
  targetConfig: FieldConfig,
): Promise<void> {
  for (const [field, { visible, required }] of Object.entries(
    targetConfig,
  ) as Entries<FieldConfig>) {
    const visibleSel = Settings.FieldConfig.visibleCheckbox(field)
    const requiredSel = Settings.FieldConfig.requiredCheckbox(field)

    const isVisible = await getCheckedState(visibleSel)
    if (isVisible !== visible) {
      await toggleState(visibleSel, visible)
      await maybeWaitForSettingsUpdate(isLoggedIn, tracker)
    }

    const isRequired = await getCheckedState(requiredSel)
    if (isRequired !== required) {
      await toggleState(requiredSel, required)
      await maybeWaitForSettingsUpdate(isLoggedIn, tracker)
    }
  }
}

export async function setSettings(
  isLoggedIn: boolean,
  tracker: RequestCounts,
  settings: Pick<UserSettings, 'fieldConfig'>,
): Promise<void> {
  const page = getPage()
  await page.locator(Selectors.MENU_BTN).click()
  await page.locator(Menu.SETTINGS).click()

  await setFieldConfig(isLoggedIn, tracker, settings.fieldConfig)

  if (isLoggedIn) {
    const current = await getSettings()
    expect(current).toMatchObject(settings)
  }
}

export function getCheckedStateOf(selector: string): Promise<boolean> {
  return getCheckedState(selector)
}

export function toggleStateOf(
  selector: string,
  newState: boolean,
): Promise<void> {
  return toggleState(selector, newState)
}
