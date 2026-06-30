import firebase from 'firebase/compat/app'
import 'firebase/compat/auth'
import { attachCustomCommands } from 'cypress-firebase'
import { format, parse } from 'date-fns'

import { TestPaths } from '~/shared/constants'
import type { Task as AppTask } from '~/shared/schema'
import { createEnvSchema } from '~/shared/schema'
import { ApiPaths, Selectors } from './constants'
import { getElementArrayText, isLoggedIn } from './utils'

const envVars = createEnvSchema([
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'CYPRESS_TEST_USER_ID',
]).parse(Cypress.env())

firebase.initializeApp({
  apiKey: envVars.FIREBASE_API_KEY,
  authDomain: envVars.FIREBASE_AUTH_DOMAIN,
  projectId: envVars.FIREBASE_PROJECT_ID,
})

attachCustomCommands({ Cypress, cy, firebase })

declare global {
  namespace Cypress {
    interface Chainable {
      /** Signs in as the test user via Firebase custom token. */
      loginAsTestUser(): Chainable<void>
      /** Returns the current Firebase user's ID token for authenticated cy.request calls. */
      getAuthToken(): Chainable<string>
      /** Makes an authenticated cy.request with the current Firebase user's Bearer token. */
      authRequest<T>(method: string, url: string): Chainable<Response<T>>
      /** Fetches tasks from the API (authenticated) or test backdoor (guest). */
      getApiTasks(): Chainable<AppTask[]>
      /** Deletes all tasks for the test user. */
      clearTestUserTasks(): Chainable<void>
      /** Resets the test user's settings to their defaults on the server. */
      resetTestUserSettings(): Chainable<void>

      /**
       * Escapes if within a .within() by returning the entire `body` element
       */
      escapeWithin(): Chainable<JQuery<HTMLElement>>
      getElementArrayText(): Chainable<(string | null)[]>
      selectOption(value: string): Chainable<void>
      getCheckedState(): Chainable<boolean>
      toggleState(newState: boolean): Chainable<JQuery<HTMLElement>>
      /** Asserts that a date picker button shows the given date. */
      checkDate(date: Date): Chainable<JQuery<HTMLElement>>
      /** Opens a date picker and selects the given date. */
      selectDate(date: Date): Chainable<JQuery<HTMLElement>>
    }
  }
}

Cypress.Commands.add('loginAsTestUser', () =>
  cy.login(envVars.CYPRESS_TEST_USER_ID),
)

Cypress.Commands.add('getAuthToken', () => {
  const user = firebase.auth().currentUser
  if (!user)
    throw new Error('No Firebase user — call cy.loginAsTestUser() first')
  return cy.wrap(user.getIdToken())
})

Cypress.Commands.add('authRequest', (method, url) =>
  cy.getAuthToken().then((token) =>
    cy.request({
      method,
      url,
      headers: { Authorization: `Bearer ${token}` },
    }),
  ),
)

Cypress.Commands.add('getApiTasks', () =>
  isLoggedIn()
    ? cy.authRequest<AppTask[]>('GET', ApiPaths.GET_TASKS).its('body')
    : cy.request<AppTask[]>('GET', TestPaths.TEST_TASKS).its('body'),
)

Cypress.Commands.add('clearTestUserTasks', () => {
  cy.request('DELETE', TestPaths.TEST_TASKS) //
    .should('have.property', 'status', 200)
})

Cypress.Commands.add('resetTestUserSettings', () => {
  cy.request('DELETE', TestPaths.TEST_RESET_SETTINGS) //
    .should('have.property', 'status', 200)
})

Cypress.Commands.addQuery('escapeWithin', () => () => cy.$$('body'))

Cypress.Commands.addQuery(
  'getElementArrayText',
  () => (subject: JQuery<HTMLElement>) => getElementArrayText(subject),
)

Cypress.Commands.add(
  'selectOption',
  { prevSubject: 'element' },
  (subject, value) => {
    cy.wrap(subject).click()
    cy.escapeWithin()
      .find('[role="listbox"]')
      .contains(new RegExp(`^${value}$`))
      .click()
  },
)

Cypress.Commands.add(
  'getCheckedState',
  { prevSubject: 'element' },
  (subject) => {
    const state = Cypress.$(subject).attr('data-state')
    if (state === 'checked') return cy.wrap(true)
    if (state === 'unchecked') return cy.wrap(false)
    throw new Error('Element does not have a data-state attribute')
  },
)

Cypress.Commands.add(
  'toggleState',
  { prevSubject: 'element' },
  (subject, newState) => {
    cy.wrap(subject).getCheckedState().should('eq', !newState)
    cy.wrap(subject).click()
    cy.wrap(subject).getCheckedState().should('eq', newState)
  },
)

Cypress.Commands.add('checkDate', { prevSubject: 'element' }, (subject, date) =>
  cy.wrap(subject).scrollIntoView().should('contain.text', format(date, 'PPP')),
)

Cypress.Commands.add(
  'selectDate',
  { prevSubject: 'element' },
  (subject, date) => {
    cy.wrap(subject).click()

    cy.get(Selectors.DatePicker.MONTH_YEAR)
      .invoke('text')
      .then((captionText) => {
        const displayed = parse(captionText.trim(), 'MMMM yyyy', new Date())
        const monthDiff =
          (date.getFullYear() - displayed.getFullYear()) * 12 +
          (date.getMonth() - displayed.getMonth())

        if (monthDiff !== 0) {
          const navLabel =
            monthDiff > 0
              ? Selectors.DatePicker.NEXT_MONTH_BTN
              : Selectors.DatePicker.PREV_MONTH_BTN
          for (let i = 0; i < Math.abs(monthDiff); i++) {
            cy.get(navLabel).click()
          }
        }
      })

    cy.get(`[data-day="${format(date, 'yyyy-MM-dd')}"] button`).click()
    return cy.wrap(subject).checkDate(date)
  },
)
