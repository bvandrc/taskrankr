export function createObject<const Keys extends readonly string[], Schema>(
  keys: Keys,
  value: Schema,
) {
  return Object.fromEntries(keys.map((key) => [key, value])) as Record<
    Keys[number],
    Schema
  >
}
