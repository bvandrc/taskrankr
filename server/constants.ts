export const ERRORS = {
  TASK_NOT_FOUND: {
    status: 404,
    body: { message: 'Task not found' },
  },
  PARENT_NOT_FOUND: {
    status: 404,
    body: { message: 'Parent task not found' },
  },
  TIME_SPENT_REQUIRED: {
    status: 400,
    body: { message: 'Time spent must be recorded to complete this task' },
  },
  INCOMPLETE_SUBTASKS: {
    status: 400,
    body: { message: 'All subtasks must be completed first' },
  },
} as const
