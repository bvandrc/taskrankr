import {
  test as baseTest,
  expect,
  request as playwrightRequest,
} from '@playwright/test'
import type { EmptyObject, Except, Simplify, Spread } from 'type-fest'

import { TestPaths } from '~/shared/constants'
import type { Task, TaskStatus } from '~/shared/schema'
import { ApiPaths, DefaultTaskFields } from './constants'
import {
  setApiContext,
  setIsLoggedIn,
  setPage,
  setRequestTracker,
} from './test-globals'
import { createCustomToken, firebaseClientConfig } from './utils/auth'

export type UserMode = 'user' | 'guest'

export type RequestCounts = {
  create: number
  update: number
  delete: number
  updateSettings: number
}

type BuildTaskFields = Partial<Except<Task, 'name' | 'status'>>

function buildTask(testSuffix: string) {
  return function buildTaskForTest<
    N extends string,
    S extends TaskStatus,
    F extends BuildTaskFields | undefined = undefined,
  >(name: N, status: S, fields?: F) {
    return {
      ...DefaultTaskFields,
      ...fields,
      status,
      name: `${name} [${testSuffix}]`,
    } as Simplify<
      Spread<
        Spread<typeof DefaultTaskFields, F extends undefined ? EmptyObject : F>,
        { name: N; status: S }
      >
    >
  }
}

let cachedIdToken: { token: string; expiresAt: number } | undefined

async function getIdToken(): Promise<string> {
  if (cachedIdToken && Date.now() < cachedIdToken.expiresAt - 60_000) {
    return cachedIdToken.token
  }

  const customToken = await createCustomToken()
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseClientConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  )
  if (!res.ok) {
    throw new Error(
      `ID token exchange failed: ${res.status} ${await res.text()}`,
    )
  }

  const { idToken, expiresIn } = (await res.json()) as {
    idToken: string
    expiresIn: string
  }
  cachedIdToken = {
    token: idToken,
    expiresAt: Date.now() + Number(expiresIn) * 1000,
  }
  return idToken
}

type Fixtures = {
  userMode: UserMode
  isLoggedIn: boolean
  testSuffix: string
  buildTask: ReturnType<typeof buildTask>
  _setup: undefined
}

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

  buildTask: async ({ testSuffix }, use) => {
    await use(buildTask(testSuffix))
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
