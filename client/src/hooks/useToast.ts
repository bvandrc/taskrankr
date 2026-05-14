/**
 * @fileoverview Toast notification hook and state management.
 */

import { useEffect, useState } from 'react'

import type {
  ToastActionElement,
  ToastProps,
} from '@/components/primitives/overlays/Toast'
import { removeIds } from '~/shared/utils/id-list-utils'

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1500

interface ToasterToast extends Omit<ToastProps, 'title' | 'description'> {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

let count = 0

const genId = () => {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

enum ToastActionType {
  ADD = 'ADD',
  UPDATE = 'UPDATE',
  DISMISS = 'DISMISS',
  REMOVE = 'REMOVE',
}

type ToastAction =
  | { type: ToastActionType.ADD; toast: ToasterToast }
  | { type: ToastActionType.UPDATE; toast: Partial<ToasterToast> }
  | { type: ToastActionType.DISMISS; toastId?: ToasterToast['id'] }
  | { type: ToastActionType.REMOVE; toastId?: ToasterToast['id'] }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: ToastActionType.REMOVE, toastId })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: ToastAction): State => {
  switch (action.type) {
    case ToastActionType.ADD:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case ToastActionType.UPDATE:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      }

    case ToastActionType.DISMISS: {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((t) => {
          addToRemoveQueue(t.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      }
    }
    case ToastActionType.REMOVE:
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: removeIds(state.toasts, [action.toastId]),
      }

    default:
      throw new Error(`Unknown action type: ${action satisfies never}`)
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

const dispatch = (action: ToastAction) => {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, 'id'>

export const toast = ({ ...props }: Toast) => {
  const id = genId()

  // biome-ignore lint/nursery/noShadow: is fine
  const update = (props: ToasterToast) =>
    dispatch({
      type: ToastActionType.UPDATE,
      toast: { ...props, id },
    })

  const dismiss = () => dispatch({ type: ToastActionType.DISMISS, toastId: id })
  dispatch({
    type: ToastActionType.ADD,
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id,
    dismiss,
    update,
  }
}

export const useToast = () => {
  const [state, setState] = useState<State>(memoryState)

  // biome-ignore lint/correctness/useExhaustiveDependencies: added by Replit
  useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) =>
      dispatch({ type: ToastActionType.DISMISS, toastId }),
  }
}
