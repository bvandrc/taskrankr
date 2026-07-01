import { expect } from '@playwright/test'

import { getPage } from '../test-globals'

export async function getCheckedState(selector: string): Promise<boolean> {
  const state = await getPage().locator(selector).getAttribute('data-state')
  if (state === 'checked') return true
  if (state === 'unchecked') return false
  throw new Error(`Element ${selector} does not have a data-state attribute`)
}

export async function toggleState(selector: string, newState: boolean) {
  const current = await getCheckedState(selector)
  expect(current, `expected current state to be ${!newState}`).toBe(!newState)
  await getPage().locator(selector).click()
  await expect(getPage().locator(selector)).toHaveAttribute(
    'data-state',
    newState ? 'checked' : 'unchecked',
  )
}
