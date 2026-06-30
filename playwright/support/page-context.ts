import type { Page } from '@playwright/test'

let _page: Page | undefined

export function setPage(p: Page): void {
  _page = p
}

export function getPage(): Page {
  if (!_page) throw new Error('getPage() called outside of a test context')
  return _page
}
