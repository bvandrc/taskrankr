import { Routes } from '@client/lib/constants'

import { Selectors } from '../constants'

export const checkIsAtHomePage = () => {
  cy.get(Selectors.Pages.COMPLETED).should('not.exist')
  cy.get(Selectors.Pages.HOME).should('be.visible')
  cy.url().should('not.include', Routes.COMPLETED)
}

export const goToCompletedPage = () => {
  cy.get(Selectors.MENU_BTN).click()
  cy.get(Selectors.Menu.COMPLETED).click()
  cy.get(Selectors.Pages.COMPLETED).should('be.visible')
  cy.get(Selectors.Pages.HOME).should('not.exist')
}
