import { cloneDeepWith } from 'es-toolkit'
import type { SetRequired } from 'type-fest'

import type { Task, UserSettings } from '~/shared/schema'
import { ApiPaths } from '../constants'
import { isLoggedIn } from './test-runner'

const getLocalStateTasks = (): Cypress.Chainable<Task[]> =>
  cy.window().then<Task[]>((win) => {
    const storageMode = isLoggedIn() ? 'auth' : 'guest'
    const localStateTasksKey = `taskrankr-${storageMode}-tasks`
    const storedTasks = win.localStorage.getItem(localStateTasksKey)

    if (!storedTasks) return []

    return JSON.parse(storedTasks)
  })

function checkTasksBackend(
  checkTasks: (givenTasks: Task[], message: string) => void,
  checkBackend?: boolean,
): void {
  getLocalStateTasks().should((givenTasks) =>
    checkTasks(givenTasks, 'local state'),
  )
  if (checkBackend) {
    cy.getApiTasks().then((givenTasks) => checkTasks(givenTasks, 'backend'))
  }
}

export const checkTasksExistBackend = (
  tasks: SetRequired<Partial<Task>, 'name' | 'status'>[],
) =>
  checkTasksBackend((givenTasks, message) => {
    const expectedTaskNames = tasks.map((t) => t.name)
    expect(
      givenTasks.map((t) => t.name),
      `task names in ${message}`,
    ).to.include.members(expectedTaskNames)
    expect(givenTasks, 'no duplicate tasks').to.have.length(
      Cypress._.uniqBy(givenTasks, (t) => t.name).length,
    )
    for (const expectedTask of tasks) {
      const givenTask = givenTasks.find((t) => t.name === expectedTask.name)
      const normalized = cloneDeepWith(expectedTask, (v) =>
        v instanceof Date ? v.toISOString() : undefined,
      )
      expect(
        givenTask,
        `Task "${expectedTask.name}" exists in ${message} with correct props`,
      ).to.deep.include(normalized)
    }
  }, isLoggedIn())

export const checkTasksDontExistBackend = (tasks: Pick<Task, 'name'>[]) =>
  checkTasksBackend((givenTasks, message) => {
    const expectedTaskNames = tasks.map((t) => t.name)
    // best way to check that array doesn't include any members
    expect(
      givenTasks.reduce((running: Record<string, Task>, curr) => {
        running[curr.name] = curr
        return running
      }, {}),
      `tasks do not exist in ${message}`,
    ).to.not.include.any.keys(expectedTaskNames)
  }, true)

export const getSettings = () =>
  cy.authRequest<UserSettings>('GET', ApiPaths.GET_SETTINGS).its('body')
