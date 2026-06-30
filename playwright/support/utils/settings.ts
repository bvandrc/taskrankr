import { expect } from '@playwright/test'
import type { Entries } from 'type-fest'

import type { FieldConfig, UserSettings } from '~/shared/schema'
import { Selectors } from '../constants'
import { getIsLoggedIn, getPage, getRequestTracker } from '../test-globals'
import { getSettings } from './api'
import { getCheckedState, toggleState } from './index'

const { Menu, Settings } = Selectors

async function maybeWaitForSettingsUpdate(): Promise<void> {
  if (!getIsLoggedIn()) return
  const tracker = getRequestTracker()
  const expected = tracker.updateSettings + 1
  await expect(() => {
    expect(tracker.updateSettings).toBeGreaterThanOrEqual(expected)
  }).toPass({ timeout: 5000 })
}

async function setFieldConfig(targetConfig: FieldConfig): Promise<void> {
  for (const [field, { visible, required }] of Object.entries(
    targetConfig,
  ) as Entries<FieldConfig>) {
    const visibleSel = Settings.FieldConfig.visibleCheckbox(field)
    const requiredSel = Settings.FieldConfig.requiredCheckbox(field)

    const isVisible = await getCheckedState(visibleSel)
    if (isVisible !== visible) {
      await toggleState(visibleSel, visible)
      await maybeWaitForSettingsUpdate()
    }

    const isRequired = await getCheckedState(requiredSel)
    if (isRequired !== required) {
      await toggleState(requiredSel, required)
      await maybeWaitForSettingsUpdate()
    }
  }
}

export async function setSettings(
  settings: Pick<UserSettings, 'fieldConfig'>,
): Promise<void> {
  const page = getPage()
  await page.locator(Selectors.MENU_BTN).click()
  await page.locator(Menu.SETTINGS).click()

  await setFieldConfig(settings.fieldConfig)

  if (getIsLoggedIn()) {
    const current = await getSettings()
    expect(current).toMatchObject(settings)
  }
}

export const setSettings = (settings: Pick<UserSettings, 'fieldConfig'>) => {
  const loggedIn = isLoggedIn()

  cy.get(Selectors.MENU_BTN).click()
  cy.get(Menu.SETTINGS).click()

  cy.intercept('PATCH', ApiPaths.UPDATE_SETTINGS).as('updateSettings')

  setFieldConfig(settings.fieldConfig)

  loggedIn &&
    getSettings().then((currentSettings) => {
      expect(currentSettings).to.deep.include(settings)
    })
}
