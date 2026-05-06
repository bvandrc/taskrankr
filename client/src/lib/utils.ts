/**
 * @fileoverview General utility functions.
 */

import { forwardRef } from 'react'
import { type ClassValue, clsx } from 'clsx'
import { without as withoutEsToolkit } from 'es-toolkit'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const without = <const T, const V extends readonly T[]>(
  array: readonly T[],
  ...values: V
) => withoutEsToolkit(array, ...values) as Exclude<T, V[number]>[]

type ForwardRefRenderFunction<T, P> = React.ForwardRefRenderFunction<
  T,
  React.PropsWithoutRef<P>
>

// biome-ignore lint/complexity/noBannedTypes:not necessary
export function forwardRefHelper<T extends React.ElementType, ExtraProps = {}>(
  render: ForwardRefRenderFunction<
    React.ElementRef<T>,
    React.ComponentPropsWithoutRef<T> & ExtraProps
  >,
  name: string | T,
): React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<T> &
    ExtraProps &
    React.RefAttributes<React.ElementRef<T>>
>
// biome-ignore lint/complexity/noBannedTypes:not necessary
export function forwardRefHelper<T extends HTMLElement, ExtraProps = {}>(
  render: ForwardRefRenderFunction<T, React.HTMLAttributes<T> & ExtraProps>,
  name: string,
): React.ForwardRefExoticComponent<
  React.HTMLAttributes<T> & ExtraProps & React.RefAttributes<T>
>
export function forwardRefHelper<T, P>(
  render: ForwardRefRenderFunction<T, P>,
  name: string | React.ElementType,
) {
  const Comp = forwardRef(render)
  Comp.displayName = typeof name === 'string' ? name : name.displayName
  return Comp
}

export const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault() // Prevents page scrolling when Space is pressed
    event.currentTarget.click()
  }
}
