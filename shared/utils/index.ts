export const createObject = <const Keys extends readonly string[], Schema>(
  keys: Keys,
  value: Schema,
) =>
  Object.fromEntries(keys.map((key) => [key, value])) as Record<
    Keys[number],
    Schema
  >
