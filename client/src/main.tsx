/**
 * @fileoverview Application entry point and React root initialization
 */

import { createRoot } from 'react-dom/client'

import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'
import { hoursToMilliseconds } from 'date-fns'

if (import.meta.env.PROD) {
  registerSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update()
        }, hoursToMilliseconds(1))
      }
    },
  })
} else if ('serviceWorker' in navigator) {
  // Local dev: a stale SW can serve index.html for /src/*.tsx and break module loading.
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) void reg.unregister()
  })
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}
createRoot(rootElement).render(<App />)
