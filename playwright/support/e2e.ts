import './commands'

import installLogsCollector from 'cypress-terminal-report/src/installLogsCollector'

import { isLoggedIn } from './utils'
import { interceptCreate, interceptUpdate } from './utils/intercepts'

installLogsCollector()

beforeEach(() => {
  const loggedIn = isLoggedIn()
  if (loggedIn) {
    cy.loginAsTestUser()
    cy.clearTestUserTasks()
    cy.resetTestUserSettings()
  } else {
    cy.clearTestUserTasks()
  }

  interceptCreate()
  interceptUpdate()
})
