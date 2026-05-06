import { z } from 'zod'

type DefaultedKeys<S extends z.ZodRawShape> = {
  [K in keyof S]: S[K] extends z.ZodDefault<z.ZodTypeAny> ? K : never
}[keyof S]

export type SchemaDefaults<T extends z.AnyZodObject> = {
  [K in DefaultedKeys<T['shape']>]: z.infer<T['shape'][K]>
}

/**
 * Returns the resolved default value of every field in `schema` whose top-level
 * schema is a `ZodDefault`.
 *
 * Caveat: function-style defaults (e.g. `z.date().default(() => new Date())`)
 * are evaluated once when this helper is called. For values that must be
 * recomputed per use (like timestamps), evaluate at the call site instead.
 */
export const getZodSchemaDefaults = <T extends z.AnyZodObject>(
  schema: T,
): SchemaDefaults<T> => {
  const mask: Record<string, true> = {}
  for (const [key, field] of Object.entries(schema.shape)) {
    if (field instanceof z.ZodDefault) mask[key] = true
  }
  // biome-ignore lint/suspicious/noExplicitAny: `.pick`'s `Exactly` constraint can't be satisfied with a dynamically-built mask-- it's fine, we specify the return type.
  return schema.pick(mask as any).parse({}) as SchemaDefaults<T>
}
