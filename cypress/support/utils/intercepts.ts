import type { RankField, Task } from '~/shared/schema'
import { ApiPaths } from '../constants'
import { checkTasksDontExistBackend, checkTasksExistBackend } from './api'
import { isLoggedIn } from './test-runner'

/** helper function */
function maybeWaitForIntercept(
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
}

export const interceptCreate = () =>
  cy.intercept('POST', ApiPaths.CREATE_TASK).as('createTask')

export type CreatedTask = Pick<Task, 'name' | 'status' | RankField>

export function waitForCreate(tasks: CreatedTask[]): void {
  maybeWaitForIntercept('@createTask', tasks.length, 201)
  checkTasksExistBackend(tasks)
}

export const interceptDelete = () =>
  cy.intercept('DELETE', ApiPaths.DELETE_TASK).as('deleteTask')

export const waitForDelete = (tasks: Pick<Task, 'name'>[]) => {
  maybeWaitForIntercept('@deleteTask', tasks.length, 204)
  checkTasksDontExistBackend(tasks)
}

export const interceptUpdate = () =>
  cy.intercept('PUT', ApiPaths.UPDATE_TASK).as('updateTask')

export const waitForUpdate = (tasks: CreatedTask[]) => {
  maybeWaitForIntercept('@updateTask', tasks.length, 200)
  checkTasksExistBackend(tasks)
}

export const checkNumCalls = ({
  create,
  update,
}: {
  create?: number
  update?: number
}) => {
  const loggedIn = isLoggedIn()
  if (create !== undefined) {
    cy.get('@createTask.all').should('have.length', loggedIn ? create : 0)
  }
  if (update !== undefined) {
    cy.get('@updateTask.all').should('have.length', loggedIn ? update : 0)
  }
}
