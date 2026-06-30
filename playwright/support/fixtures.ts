import { test as baseTest, expect, type Response } from '@playwright/test'

import { TestPaths } from '~/shared/constants'
import type { Task } from '~/shared/schema'
import { ApiPaths } from './constants'
import { getPage, setIsLoggedIn, setPage } from './page-context'

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
  requestTracker: RequestCounts
  _setup: void
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
  userMode: async (_fixtures, use, testInfo) => {
    await use(testInfo.project.name as UserMode)
  },

  isLoggedIn: async ({ userMode }, use) => {
    await use(userMode === 'user')
  },

  testSuffix: async (_fixtures, use, testInfo) => {
    const suffix = `w${testInfo.workerIndex}-${Date.now().toString(36).slice(-5)}`
    await use(suffix)
  },

  taskName: async ({ testSuffix }, use) => {
    await use((baseName: string) => `${baseName} [${testSuffix}]`)
  },

  requestTracker: async ({ page, isLoggedIn }, use) => {
    const counts: RequestCounts = {
      create: 0,
      update: 0,
      delete: 0,
      updateSettings: 0,
    }

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

    await use(counts)
  },

  _setup: [
    async ({ page, isLoggedIn, testSuffix }, use) => {
      setPage(page)
      setIsLoggedIn(isLoggedIn)

      if (isLoggedIn) {
        await page.request.delete(TestPaths.TEST_RESET_SETTINGS)
      }

      await use()

      // Clean up only tasks created by this test
      if (isLoggedIn) {
        try {
          const res = await page.request.get(ApiPaths.GET_TASKS)
          if (res.ok()) {
            const tasks: Task[] = await res.json()
            const myRoots = tasks.filter(
              (t) => t.name.includes(testSuffix) && t.parentId === null,
            )
            await Promise.all(
              myRoots.map((t) =>
                page.request
                  .delete(`/api/tasks/${t.id}`)
                  .catch(() => undefined),
              ),
            )
          }
        } catch {
          // best-effort
        }
      }
    },
    { auto: true },
  ],
})

export { expect }
