import type { FieldConfig, RankField } from '~/shared/schema'

const testId = <S extends string>(testid: S) =>
  `[data-testid="${testid}"]` as const
const testIdStartsWith = <S extends string>(testid: S) =>
  `[data-testid^="${testid}"]` as const
// biome-ignore lint/correctness/noUnusedVariables: remove rule when/if used
const testIdContains = <S extends string>(testid: S) =>
  `[data-testid*="${testid}"]` as const
// biome-ignore lint/correctness/noUnusedVariables: remove rule when/if used
const testIdEndsWith = <S extends string>(testid: S) =>
  `[data-testid$="${testid}"]` as const

export const Selectors = {
  Pages: {
    HOME: testId('home-page'),
    COMPLETED: testId('completed-page'),
  },
  CREATE_TASK_BTN: testId('button-create-task'),
  BACK_BTN: testId('button-back'),
  MENU_BTN: testId('button-menu'),
  LandingPage: {
    TRY_GUEST_BTN: testId('button-try-guest'),
  },
  Menu: {
    SETTINGS: testId('menu-item-settings'),
    HOME: testId('menu-item-home'),
    COMPLETED: testId('menu-item-completed'),
  },
  TaskCard: {
    CARD: testIdStartsWith('task-card-'),
    THIS_TASK_INFO: testIdStartsWith('task-info-'),
    TITLE: testId('task-title'),
    EXPAND_BTN: testIdStartsWith('button-expand-'),
    COLLAPSE_BTN: testIdStartsWith('button-collapse-'),
    IN_PROGRESS_BADGE: testId('badge-in-progress'),
    RankFieldBadge: (field: RankField) => testId(`badge-${field}`),
  },
  TaskForm: {
    FORM: testId('task-form'),
    NAME_INPUT: testId('task-name-input'),
    rankSelect: (field: RankField) => testId(`rank-select-${field}`),
    MARK_COMPLETED_CHECKBOX: testId('mark-completed-checkbox'),
    DATE_CREATED_PICKER: testId('date-created-picker'),
    // subtasks
    SUBTASKS_CARD: testId('subtasks-card'),
    ADD_SUBTASK_BTN: testId('button-add-subtask'),
    ASSIGN_SUBTASK_BTN: testId('button-assign-subtask'),
    SUBTASK_ROW: testIdStartsWith('subtask-row-'),
    SUBTASK_NAME: testIdStartsWith('subtask-name-'),
    SUBTASK_SETTINGS_BTN: testId('button-subtask-settings'),
    AUTOCOMPLETE_SWITCH: testId('switch-inherit-completion-state'), //autocomplete when all subtasks completed
    AUTOHIDE_COMPLETED_SUBTASKS_SWITCH: testId('switch-auto-hide-completed'),
    SHOW_HIDDEN_BTN: testId('button-show-hidden'), //show hidden subtasks
    EDIT_SUBTASK_BTN: testIdStartsWith('button-edit-subtask-'),
    // form bns
    SUBMIT_BTN: testId('submit-button'),
    CANCEL_BTN: testId('cancel-button'),
    // cancel dialog
    CANCEL_CONFIRM_DIALOG: testId('cancel-task-form-confirm-dialog'),
    CANCEL_CONFIRM_BTN: testId('button-confirm'),
    CANCEL_DENY_BTN: testId('button-cancel'),
  },
  AssignSubtaskDialog: {
    DIALOG: testId('assign-subtask-dialog'),
    SEARCH_INPUT: testId('search-assign-tasks'),
    ORPHAN_TASK_LIST: testId('list-orphan-tasks'),
    taskOption: (id: number) => testId(`option-assign-task-${id}`),
    TASK_OPTION: testIdStartsWith('option-assign-task-'),
    CANCEL_BTN: testId('button-cancel-assign'),
    CONFIRM_BTN: testId('button-confirm-assign'),
  },
  ChangeStatusDialog: {
    DIALOG: testId('change-status-dialog'),
    COMPLETE_BTN: testId('button-complete-task'),
  },
  ConfirmDialog: {
    CONFIRM_BTN: testId('button-confirm'),
    DENY_BTN: testId('button-cancel'),
  },
  Settings: {
    FieldConfig: {
      visibleCheckbox: (field: keyof FieldConfig) =>
        testId(`checkbox-${field}-visible`),
      requiredCheckbox: (field: keyof FieldConfig) =>
        testId(`checkbox-${field}-required`),
    },
  },
  SaveOpenSubtasksConfirmDialog: {
    DIALOG: testId('saving-will-reopen-dialog'),
  },
  Toasts: {
    ERROR: testId('toast-danger'),
    DEFAULT: testId('toast-default'),
  },
  DatePicker: {
    MONTH_YEAR: '[data-radix-popper-content-wrapper] [role="status"]',
    PREV_MONTH_BTN: `[aria-label="Go to the Previous Month"]`,
    NEXT_MONTH_BTN: `[aria-label="Go to the Next Month"]`,
  },
} as const
