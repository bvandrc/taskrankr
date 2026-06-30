import { expect, type Page } from '@playwright/test'

import { Routes } from '../../../client/src/lib/constants'
import { Selectors } from '../constants'

export async function checkIsAtHomePage(page: Page): Promise<void> {
  await expect(page.locator(Selectors.Pages.COMPLETED)).not.toBeAttached()
  await expect(page.locator(Selectors.Pages.HOME)).toBeVisible()
  await expect(page).not.toHaveURL(new RegExp(Routes.COMPLETED))
}

export async function goToHomePage(page: Page): Promise<void> {
  await page.locator(Selectors.MENU_BTN).click()
  await page.locator(Selectors.Menu.HOME).click()
  await checkIsAtHomePage(page)
}

export async function goToCompletedPage(page: Page): Promise<void> {
  await page.locator(Selectors.MENU_BTN).click()
  await page.locator(Selectors.Menu.COMPLETED).click()
  await expect(page.locator(Selectors.Pages.COMPLETED)).toBeVisible()
  await expect(page.locator(Selectors.Pages.HOME)).not.toBeAttached()
}
