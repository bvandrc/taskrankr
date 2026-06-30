import type { Entries } from 'type-fest'

import type { FieldConfig, UserSettings } from '~/shared/schema'
import { ApiPaths, Selectors } from '../constants'
import { getSettings } from './api'
import { maybeWaitForResponses } from './intercepts'
import { isLoggedIn } from './test-runner'

const { Menu, Settings } = Selectors

function setFieldConfig(targetConfig: FieldConfig) {
  for (const [field, { visible, required }] of Object.entries(
    targetConfig,
  ) as Entries<FieldConfig>) {
    const visibleSel = Settings.FieldConfig.visibleCheckbox(field)
    const requiredSel = Settings.FieldConfig.requiredCheckbox(field)

    cy.get(visibleSel)
      .getCheckedState()
      .then((isChecked) => {
        if (isChecked !== visible) {
          cy.get(visibleSel).toggleState(visible)
          maybeWaitForResponses('@updateSettings', 1, 200)
        }
      })

    cy.get(requiredSel)
      .getCheckedState()
      .then((isChecked) => {
        if (isChecked !== required) {
          cy.get(requiredSel).toggleState(required)
          maybeWaitForResponses('@updateSettings', 1, 200)
        }
      })
  }
}

export function setSettings(settings: Pick<UserSettings, 'fieldConfig'>) {
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
