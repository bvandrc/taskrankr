import {
  test as baseTest,
  expect,
  request as playwrightRequest,
  type Response,
} from '@playwright/test'

import { TestPaths } from '~/shared/constants'
import type { Task } from '~/shared/schema'
import { ApiPaths } from './constants'
import {
  getPage,
  setApiContext,
  setIsLoggedIn,
  setPage,
  setRequestTracker,
} from './test-globals'
import { getIdToken } from './utils/auth'

export type UserMode = 'user' | 'guest'

export type RequestCounts = {
  create: number
  update: number
  delete: number
  updateSettings: number
}

type Fixtures = {
  userMode: UserMode
  isLoggedIn: boolean
  testSuffix: string
  taskName: (baseName: string) => string
  _setup: undefined
}

function isCreateResponse(r: Response) {
  return (
    r.url().includes(ApiPaths.GET_TASKS) &&
    r.request().method() === 'POST' &&
    !r.url().includes('/import') &&
    r.status() === 201
  )
}

function isUpdateResponse(r: Response) {
  return (
    ApiPaths.UPDATE_TASK.test(r.url()) &&
    r.request().method() === 'PATCH' &&
    r.status() === 200
  )
}

export function waitForNResponses(
  predicate: (r: Response) => boolean,
  n: number,
  timeout = 15_000,
): Promise<void> {
  if (n === 0) return Promise.resolve()
  const page = getPage()
  return new Promise<void>((resolve, reject) => {
    let count = 0
    const timer = setTimeout(() => {
      page.off('response', handler)
      reject(
        new Error(
          `Timed out waiting for ${n} matching responses (got ${count})`,
        ),
      )
    }, timeout)
    const handler = (r: Response) => {
      if (predicate(r)) {
        count++
        if (count >= n) {
          clearTimeout(timer)
          page.off('response', handler)
          resolve()
        }
      }
    }
    page.on('response', handler)
  })
}

export const waitForCreate = (n: number) =>
  waitForNResponses(isCreateResponse, n)

export const waitForUpdate = (n: number) =>
  waitForNResponses(isUpdateResponse, n)

export const test = baseTest.extend<Fixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring for the fixtures arg
  userMode: async ({}, use, testInfo) => {
    await use(testInfo.project.name as UserMode)
  },

  isLoggedIn: async ({ userMode }, use) => {
    await use(userMode === 'user')
  },

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring for the fixtures arg
  testSuffix: async ({}, use, testInfo) => {
    const suffix = `w${testInfo.workerIndex}-${Date.now().toString(36).slice(-5)}`
    await use(suffix)
  },

  taskName: async ({ testSuffix }, use) => {
    await use((baseName: string) => `${baseName} [${testSuffix}]`)
  },

  _setup: [
    async ({ page, isLoggedIn, testSuffix }, use, testInfo) => {
      setPage(page)
      setIsLoggedIn(isLoggedIn)

      const counts: RequestCounts = {
        create: 0,
        update: 0,
        delete: 0,
        updateSettings: 0,
      }
      setRequestTracker(counts)

      // Authenticated suite: a request context carrying the test user's Bearer
      // token, used for backend verification and cleanup. Guest mode has no
      // backend, so the page's own (unauthenticated) context suffices.
      const apiContext = isLoggedIn
        ? await playwrightRequest.newContext({
            baseURL: testInfo.project.use.baseURL,
            extraHTTPHeaders: { Authorization: `Bearer ${await getIdToken()}` },
          })
        : page.request
      setApiContext(apiContext)

      if (isLoggedIn) {
        page.on('response', (r) => {
          const url = r.url()
          const method = r.request().method()
          if (
            url.includes(ApiPaths.GET_TASKS) &&
            method === 'POST' &&
            !url.includes('/import')
          )
            counts.create++
          if (ApiPaths.UPDATE_TASK.test(url) && method === 'PATCH')
            counts.update++
          if (ApiPaths.DELETE_TASK.test(url) && method === 'DELETE')
            counts.delete++
          if (url.includes(ApiPaths.UPDATE_SETTINGS) && method === 'PATCH')
            counts.updateSettings++
        })
      }

      if (isLoggedIn) {
        await apiContext.delete(TestPaths.TEST_RESET_SETTINGS)
      }

      await use(undefined)

      // Clean up only tasks created by this test
      if (isLoggedIn) {
        try {
          const res = await apiContext.get(ApiPaths.GET_TASKS)
          if (res.ok()) {
            const tasks: Task[] = await res.json()
            const myRoots = tasks.filter(
              (t) => t.name.includes(testSuffix) && t.parentId === null,
            )
            await Promise.all(
              myRoots.map((t) =>
                apiContext.delete(`/api/tasks/${t.id}`).catch(() => undefined),
              ),
            )
          }
        } catch {
          // best-effort
        }
        await apiContext.dispose()
      }
    },
    { auto: true },
  ],
})

export { expect }
