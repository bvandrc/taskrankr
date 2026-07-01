import type { APIRequestContext, Page } from '@playwright/test'

import type { RequestCounts } from './fixtures'

let _page: Page | undefined
let _isLoggedIn: boolean | undefined
let _requestTracker: RequestCounts | undefined
let _apiContext: APIRequestContext | undefined

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

export function setRequestTracker(counts: RequestCounts): void {
  _requestTracker = counts
}

export function getRequestTracker(): RequestCounts {
  if (!_requestTracker)
    throw new Error('getRequestTracker() called outside of a test context')
  return _requestTracker
}

export function setApiContext(context: APIRequestContext): void {
  _apiContext = context
}

/** API request context carrying the test user's `Bearer` token (auth suite). */
export function getApiContext(): APIRequestContext {
  if (!_apiContext)
    throw new Error('getApiContext() called outside of a test context')
  return _apiContext
}
