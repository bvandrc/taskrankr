import type { RankField, Task } from '~/shared/schema'
import { ApiPaths, Selectors } from '../constants'
import { checkTasksDontExistBackend, checkTasksExistBackend } from './api'
import { isLoggedIn } from './test-runner'

/** helper function */
export function maybeWaitForIntercept(
  alias: string,
  count: number,
  expectedStatus: number,
): void {
  const loggedIn = isLoggedIn()
  loggedIn &&
    cy.wait(Array(count).fill(alias)).then((interceptionResult) => {
      // if only 1 alias is passed, is not an array.
      const interceptions = Array.isArray(interceptionResult)
        ? interceptionResult
        : [interceptionResult]

      interceptions.forEach((interception, index) => {
        expect(
          interception.response?.statusCode,
          `interception #${index} statusCode`,
        ).to.equal(expectedStatus)
      })
    })
  cy.get(Selectors.Toasts.ERROR).should('not.exist')
}

export type CreatedTask = Pick<Task, 'name' | 'status' | RankField>

let _createTaskWaitCount = 0

export const interceptCreate = () =>
  cy.intercept('POST', ApiPaths.CREATE_TASK).as('createTask')

export function waitForCreate(tasks: CreatedTask[]): void {
  maybeWaitForIntercept('@createTask', tasks.length, 201)
  checkTasksExistBackend(tasks)
  _createTaskWaitCount += tasks.length
}

let _deleteTaskWaitCount = 0

export const interceptDelete = () =>
  cy.intercept('DELETE', ApiPaths.DELETE_TASK).as('deleteTask')

export const waitForDelete = (tasks: Pick<Task, 'name'>[]) => {
  maybeWaitForIntercept('@deleteTask', tasks.length, 204)
  checkTasksDontExistBackend(tasks)
  _deleteTaskWaitCount += tasks.length
}

let _updateTaskWaitCount = 0

export const interceptUpdate = () =>
  cy.intercept('PATCH', ApiPaths.UPDATE_TASK).as('updateTask')

export const waitForUpdate = (tasks: CreatedTask[]) => {
  maybeWaitForIntercept('@updateTask', tasks.length, 200)
  checkTasksExistBackend(tasks)
  _updateTaskWaitCount += tasks.length
}

export const checkNumCalls = ({
  create: createCount,
  update: updateCount,
  delete: deleteCount,
  updateSettings: updateSettingsCount,
}: {
  create?: number
  update?: number
  delete?: number
  updateSettings?: number
}) => {
  // TODO: debug
  // for (const [expected, waitedFor] of [
  //   [createCount, createTaskWaitCount],
  //   [updateCount, updateTaskWaitCount],
  //   [deleteCount, deleteTaskWaitCount],
  // ]) {
  //   if (expected !== undefined && expected !== waitedFor) {
  //     expect(
  //       expected,
  //       '# expected calls should match # test has waited for',
  //     ).to.equal(waitedFor)
  //   }
  // }

  const loggedIn = isLoggedIn()
  for (const [alias, expectedCount] of [
    ['@createTask', createCount],
    ['@updateTask', updateCount],
    ['@deleteTask', deleteCount],
    ['@updateSettings', updateSettingsCount],
  ] as const) {
    if (expectedCount !== undefined) {
      cy.get(`${alias}.all`).should('have.length', loggedIn ? expectedCount : 0)
    }
  }
}
