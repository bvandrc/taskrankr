import type { Page } from '@playwright/test'

let _page: Page | undefined
let _isLoggedIn: boolean | undefined

export function setPage(p: Page): void {
  _page = p
}

export function getPage(): Page {
  if (!_page) throw new Error('getPage() called outside of a test context')
  return _page
}

export function setIsLoggedIn(value: boolean): void {
  _isLoggedIn = value
}

export function getIsLoggedIn(): boolean {
  if (_isLoggedIn === undefined)
    throw new Error('getIsLoggedIn() called outside of a test context')
  return _isLoggedIn
}
