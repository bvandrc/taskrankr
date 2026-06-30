import { expect } from '@playwright/test'
import { cloneDeepWith } from 'es-toolkit'
import type { Jsonify, PartialDeep } from 'type-fest'

import type { Task, UserSettings } from '~/shared/schema'
import { ApiPaths } from '../constants'
import { getIsLoggedIn, getPage } from '../test-globals'
import type { CreatedTask } from './intercepts'

const normalizeTask = <T extends PartialDeep<Task>>(task: T): Jsonify<T> =>
  cloneDeepWith(task, (v) =>
    v instanceof Date ? v.toISOString() : undefined,
  ) as Jsonify<T>

export function getLocalStateTasks(): Promise<Task[]> {
  const key = `taskrankr-${getIsLoggedIn() ? 'auth' : 'guest'}-tasks`
  return getPage().evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as Task[]) : []
  }, key)
}

export async function getApiTasks(): Promise<Task[]> {
  const res = await getPage().request.get(ApiPaths.GET_TASKS)
  return res.json()
}

export async function getSettings(): Promise<UserSettings> {
  const res = await getPage().request.get(ApiPaths.GET_SETTINGS)
  return res.json()
}

export async function checkTasksExist(tasks: CreatedTask[]): Promise<void> {
  await expect(async () => {
    const localTasks = await getLocalStateTasks()
    const expectedNames = tasks.map((t) => t.name)
    expect(
      localTasks.map((t) => t.name),
      'local state task names',
    ).toEqual(expect.arrayContaining(expectedNames))

    // Isolated browser context means no cross-test contamination in local state
    const uniqueNames = new Set(localTasks.map((t) => t.name))
    expect(localTasks, 'no duplicate tasks in local state').toHaveLength(
      uniqueNames.size,
    )

    for (const expectedTask of tasks) {
      const found = localTasks.find((t) => t.name === expectedTask.name)
      expect(found, `Task "${expectedTask.name}" in local state`).toBeDefined()
      if (found) expect(found).toMatchObject(normalizeTask(expectedTask))
    }
  }).toPass({ timeout: 8000 })

  if (getIsLoggedIn()) {
    await expect(async () => {
      const apiTasks = await getApiTasks()
      for (const expectedTask of tasks) {
        const found = apiTasks.find((t) => t.name === expectedTask.name)
        expect(found, `Task "${expectedTask.name}" in backend`).toBeDefined()
        if (found) expect(found).toMatchObject(normalizeTask(expectedTask))
      }
    }).toPass({ timeout: 8000 })
  }
}

export async function checkTasksDontExist(
  tasks: Pick<Task, 'name'>[],
): Promise<void> {
  await expect(async () => {
    const localTasks = await getLocalStateTasks()
    const localNames = new Set(localTasks.map((t) => t.name))
    for (const task of tasks) {
      expect(
        localNames.has(task.name),
        `Task "${task.name}" should not exist in local state`,
      ).toBe(false)
    }
  }).toPass({ timeout: 5000 })

  if (getIsLoggedIn()) {
    await expect(async () => {
      const apiTasks = await getApiTasks()
      const apiNames = new Set(apiTasks.map((t) => t.name))
      for (const task of tasks) {
        expect(
          apiNames.has(task.name),
          `Task "${task.name}" should not exist in backend`,
        ).toBe(false)
      }
    }).toPass({ timeout: 5000 })
  }
}
