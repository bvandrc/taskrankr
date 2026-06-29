/**
 * Creates a Record mapping each key to the same value.
 * Pass `as const` for object values to get readonly inference and
 * avoid accidental shared-mutation bugs.
 */
export const createObject = <const Keys extends readonly string[], Value>(
  keys: Keys,
  genValue: () => Value,
) =>
  Object.fromEntries(keys.map((key) => [key, genValue()])) as Record<
    Keys[number],
    Value
  >
