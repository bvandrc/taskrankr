export const createObject = <const Keys extends readonly string[], Value>(
  keys: Keys,
  genValue: () => Value,
) =>
  Object.fromEntries(keys.map((key) => [key, genValue()])) as Record<
    Keys[number],
    Value
  >
