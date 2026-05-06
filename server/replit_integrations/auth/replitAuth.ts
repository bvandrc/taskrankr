/**
 * @fileoverview Replit OpenID Connect authentication implementation.
 *
 * Configures Passport.js with OIDC strategy for Replit authentication.
 * Handles session management, token refresh, and user upsert on login.
 */

/** biome-ignore-all lint/style/noNonNullAssertion: added by Replit */
/** biome-ignore-all lint/complexity/useLiteralKeys: added by Replit */
/** biome-ignore-all lint/suspicious/noExplicitAny: added by Replit */
import connectPg from 'connect-pg-simple'
import { hoursToMilliseconds } from 'date-fns'
import type { Express, RequestHandler } from 'express'
import session from 'express-session'
import memoize from 'memoizee'
import * as client from 'openid-client'
import { Strategy, type VerifyFunction } from 'openid-client/passport'
import passport from 'passport'
import type { Jsonifiable } from 'type-fest'

import { AuthPaths } from '~/shared/constants'
import { authStorage } from './storage'

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? 'https://replit.com/oidc'),
      process.env.REPL_ID!,
    )
  },
  { maxAge: hoursToMilliseconds(1) },
)

export function getSession() {
  const sessionTtl = hoursToMilliseconds(24 * 30) // 30 days
  const pgStore = connectPg(session)
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: 'sessions',
  })
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // Disabled outside production so Cypress and local dev can set/replay the
      // session cookie without TLS.
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  })
}

export type UserSession = {
  claims?: client.IDToken
  expires_at?: number
  refresh_token?: string
  access_token?: string
}

function updateUserSession(
  user: UserSession,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
) {
  user.claims = tokens.claims()
  user.access_token = tokens.access_token
  user.refresh_token = tokens.refresh_token
  user.expires_at = user.claims?.exp
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims['sub'],
    email: claims['email'],
    firstName: claims['first_name'],
    lastName: claims['last_name'],
    profileImageUrl: claims['profile_image_url'],
  })
}

export async function setupAuth(app: Express) {
  app.set('trust proxy', 1)
  app.use(getSession())
  app.use(passport.initialize())
  app.use(passport.session())

  passport.serializeUser((user: Express.User, cb) => cb(null, user))
  passport.deserializeUser((user: Express.User, cb) => cb(null, user))

  /*
   * OIDC discovery fails in local/CI environments where no provider is
   * reachable, so this is necessary for those environments.
   *
   * Not a security risk: the failure mode is fail-closed
   * (login routes are never registered, so no new sessions can be created).
   * Fail-open — e.g. falling back to unauthenticated access — would be
   * dangerous, but that never happens here. Existing sessions remain valid
   * because the session middleware above always runs regardless of this result.
   */
  let config: Awaited<ReturnType<typeof getOidcConfig>> | null = null
  try {
    config = await getOidcConfig()
  } catch (err) {
    console.warn(
      '[Auth] OIDC discovery failed — OAuth login routes disabled.',
      err instanceof Error ? err.message : String(err),
    )
  }

  if (!config) return

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback,
  ) => {
    const user = {}
    updateUserSession(user, tokens)
    await upsertUser(tokens.claims())
    verified(null, user)
  }

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>()

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: 'openid email profile offline_access',
          callbackURL: `https://${domain}${AuthPaths.CALLBACK}`,
        },
        verify,
      )
      passport.use(strategy)
      registeredStrategies.add(strategyName)
    }
  }

  app.get(AuthPaths.LOGIN, (req, res, next) => {
    ensureStrategy(req.hostname)
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: 'login consent',
      scope: ['openid', 'email', 'profile', 'offline_access'],
    })(req, res, next)
  })

  app.get(AuthPaths.CALLBACK, (req, res, next) => {
    ensureStrategy(req.hostname)
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: '/',
      failureRedirect: AuthPaths.LOGIN,
    })(req, res, next)
  })

  app.get(AuthPaths.LOGOUT, (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href,
      )
    })
  })
}

export const isAuthenticated: RequestHandler<
  Record<string, string | number>,
  any,
  Jsonifiable,
  Jsonifiable
> = async (req, res, next) => {
  const user = req.user as UserSession | undefined

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const now = Math.floor(Date.now() / 1000)
  if (now <= user.expires_at) {
    return next()
  }

  const refreshToken = user.refresh_token
  if (!refreshToken) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  try {
    const config = await getOidcConfig()
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken)
    updateUserSession(user, tokenResponse)
    return next()
  } catch (_error) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }
}
