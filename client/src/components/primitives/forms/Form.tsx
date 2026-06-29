/**
 * @fileoverview Form field components with validation support.
 * Integrates react-hook-form with @radix-ui primitives.
 */

'use client'

import { createContext, useContext, useId } from 'react'
import type * as LabelPrimitive from '@radix-ui/react-label'
import { Slot } from '@radix-ui/react-slot'
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useFormContext,
} from 'react-hook-form'

import { cn, forwardRefHelper } from '@/lib/utils'
import { Label } from './Label'

export const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
)

export const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = useContext(FormFieldContext)
  const itemContext = useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>')
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = createContext<FormItemContextValue>(
  {} as FormItemContextValue,
)

export const FormItem = forwardRefHelper<HTMLDivElement>((props, ref) => {
  const id = useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div {...props} ref={ref} />
    </FormItemContext.Provider>
  )
}, 'FormItem')

export const FieldLabel = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    {...props}
    className={cn(
      'text-[10px] uppercase tracking-wider text-muted-foreground',
      className,
    )}
  />
)

export const FormLabel = forwardRefHelper<
  typeof LabelPrimitive.Root,
  { redOnError?: boolean; isRequired?: boolean }
>(({ children, className, redOnError, isRequired, ...props }, ref) => {
  const { error, formItemId } = useFormField()

  return (
    <Label
      {...props}
      ref={ref}
      className={cn(
        'text-[10px] uppercase tracking-wider text-muted-foreground',
        error && redOnError && 'text-danger',
        className,
      )}
      htmlFor={formItemId}
    >
      {children}
      {isRequired && <span className="text-danger ml-1">*</span>}
    </Label>
  )
}, 'FormLabel')

export const FormControl = forwardRefHelper<typeof Slot>(
  ({ ...props }, ref) => {
    const { error, formItemId, formDescriptionId, formMessageId } =
      useFormField()

    return (
      <Slot
        {...props}
        ref={ref}
        id={formItemId}
        aria-describedby={
          !error
            ? `${formDescriptionId}`
            : `${formDescriptionId} ${formMessageId}`
        }
        aria-invalid={!!error}
      />
    )
  },
  'FormControl',
)

export const FormDescription = forwardRefHelper<HTMLParagraphElement>(
  ({ className, ...props }, ref) => {
    const { formDescriptionId } = useFormField()

    return (
      <p
        {...props}
        ref={ref}
        id={formDescriptionId}
        className={cn('text-sm text-muted-foreground', className)}
      />
    )
  },
  'FormDescription',
)

export const FormMessage = forwardRefHelper<HTMLParagraphElement>(
  ({ className, children, ...props }, ref) => {
    const { error, formMessageId } = useFormField()
    const body = error ? String(error?.message ?? '') : children

    if (!body) {
      return null
    }

    return (
      <p
        {...props}
        ref={ref}
        id={formMessageId}
        className={cn('text-sm font-medium text-danger', className)}
      >
        {body}
      </p>
    )
  },
  'FormMessage',
)
