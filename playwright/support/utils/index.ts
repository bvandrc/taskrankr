export * from './api'
export * from './navigation'
export * from './test-runner'

import type { FieldConfig } from '~/shared/schema'

export const getElementArrayText = ($elements: JQuery<HTMLElement>) =>
  $elements.toArray().map(($el) => $el.textContent)

export type SettingsOptions = {
  /**
   * @default DEFAULT_FIELD_CONFIG
   */
  settings?: FieldConfig
}
