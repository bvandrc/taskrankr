import fs from 'node:fs'
import type { Server } from 'node:http'
import path from 'node:path'
import type { Express } from 'express'
import { nanoid } from 'nanoid'
import { createLogger, createServer as createViteServer } from 'vite'

import viteConfig from '../vite.config'

const viteLogger = createLogger()

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: '/vite-hmr' },
    allowedHosts: true,
  } as const

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options)
        process.exit(1)
      },
    },
    server: serverOptions,
    appType: 'custom',
  })

  app.use(vite.middlewares)

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl.split('?')[0]

    // Vite owns modules, deps, and static assets — only bare navigations need the SPA shell.
    if (
      url.startsWith('/api/') ||
      url.startsWith('/@') ||
      url.startsWith('/src/') ||
      url.startsWith('/node_modules/') ||
      /\.(?:js|ts|tsx|jsx|css|html|ico|png|svg|woff2?|json|map|txt|webp|jpe?g|gif|avif)$/i.test(
        url,
      )
    ) {
      return next()
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        '..',
        'client',
        'index.html',
      )

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, 'utf-8')
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      )
      const page = await vite.transformIndexHtml(url, template)
      res.status(200).set({ 'Content-Type': 'text/html' }).end(page)
    } catch (e) {
      vite.ssrFixStacktrace(e as Error)
      next(e)
    }
  })
}
