import {
  type FieldValues,
  type Path,
  type UseFormReturn,
  useWatch,
} from 'react-hook-form'

/**
 * Subscribes to every field listed in `defaults` and returns the live form
 * values, falling back to the corresponding default when the form value is
 * `undefined`. Useful when the form schema makes settings fields optional but
 * the UI needs concrete values to render.
 *
 * Falls back only on `undefined` — `null` is preserved as a deliberate value.
 *
 * The result's value types are taken from the `defaults` object, so passing
 * `taskSchemaDefaults` (or a sub-pick of it) yields fully-typed, non-undefined
 * fields.
 */
export const useFormFieldsWithDefaults = <
  T extends FieldValues,
  D extends Partial<T>,
>(
  form: UseFormReturn<T>,
  defaults: D,
): { [K in keyof D]-?: D[K] } => {
  const keys = Object.keys(defaults) as Array<keyof D & string>
  const values = useWatch({
    control: form.control,
    // biome-ignore lint/suspicious/noExplicitAny: we specify our return type here, type cast is ok
    name: keys as any as readonly Path<T>[],
    // biome-ignore lint/suspicious/noExplicitAny: we specify our return type here, type cast is ok
  }) as any[]

  const result = {} as { [K in keyof D]: D[K] }
  keys.forEach((key, i) => {
    const value = values[i]
    result[key] = (value === undefined ? defaults[key] : value) as D[typeof key]
  })
  return result as { [K in keyof D]-?: D[K] }
}
