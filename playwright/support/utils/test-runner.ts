export const checkUserMode = (mode: string | undefined) => {
  // biome-ignore lint/style/noParameterAssign: Is fine
  mode = mode?.toUpperCase()
  if (mode === undefined)
    throw new Error('userMode environment variable is not set')
  if (mode !== 'USER' && mode !== 'GUEST')
    throw new Error(`Invalid userMode environment variable value: ${mode}`)
  return mode
}

export const isLoggedIn = () =>
  checkUserMode(Cypress.env('userMode')) === 'USER'
