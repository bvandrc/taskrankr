import { contract } from '~/shared/contract'
import {
  Ease,
  Enjoyment,
  type FieldConfig,
  Priority,
  type Task,
  Time,
} from '~/shared/schema'

export * from './selectors'

export const ApiPaths = {
  GET_TASKS: contract.tasks.list.path,
  CREATE_TASK: contract.tasks.create.path,
  DELETE_TASK: new RegExp(contract.tasks.delete.path.replace(':id', '\\d+')),
  UPDATE_TASK: new RegExp(contract.tasks.update.path.replace(':id', '\\d+')),
  GET_SETTINGS: contract.settings.get.path,
  UPDATE_SETTINGS: contract.settings.update.path,
}

export const DefaultTask = {
  name: 'E2E Test Task',
  priority: Priority.HIGH,
  ease: Ease.MEDIUM,
  enjoyment: Enjoyment.LOW,
  time: Time.HIGH,
} as const satisfies Partial<Task>

export const FieldConfigAllTrue = {
  priority: { visible: true, required: true },
  ease: { visible: true, required: true },
  enjoyment: { visible: true, required: true },
  time: { visible: true, required: true },
} as const satisfies FieldConfig

export const FieldConfigAllFalse = {
  priority: { visible: false, required: false },
  ease: { visible: false, required: false },
  enjoyment: { visible: false, required: false },
  time: { visible: false, required: false },
} as const satisfies FieldConfig
