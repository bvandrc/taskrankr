import { expect } from '@playwright/test'

import { Routes } from '~/client/lib/constants'
import { Selectors } from '../constants'
import { getPage } from '../page-context'

export async function checkIsAtHomePage(): Promise<void> {
  const page = getPage()
  await expect(page.locator(Selectors.Pages.COMPLETED)).not.toBeAttached()
  await expect(page.locator(Selectors.Pages.HOME)).toBeVisible()
  await expect(page).not.toHaveURL(new RegExp(Routes.COMPLETED))
}

export async function goToHomePage(): Promise<void> {
  const page = getPage()
  await page.locator(Selectors.MENU_BTN).click()
  await page.locator(Selectors.Menu.HOME).click()
  await checkIsAtHomePage()
}

export async function goToCompletedPage(): Promise<void> {
  const page = getPage()
  await page.locator(Selectors.MENU_BTN).click()
  await page.locator(Selectors.Menu.COMPLETED).click()
  await expect(page.locator(Selectors.Pages.COMPLETED)).toBeVisible()
  await expect(page.locator(Selectors.Pages.HOME)).not.toBeAttached()
}
