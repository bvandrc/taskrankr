import { z } from 'zod'

export const authConfigSchema = z.object({
  replitAuthEnabled: z.boolean(),
  testLoginEnabled: z.boolean(),
})

export type AuthConfig = z.infer<typeof authConfigSchema>
