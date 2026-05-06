/**
 * @fileoverview Application entry point and React root initialization
 */

import { createRoot } from 'react-dom/client'

import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'
import { hoursToMilliseconds } from 'date-fns'

registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      setInterval(() => {
        registration.update()
      }, hoursToMilliseconds(1))
    }
  },
})

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}
createRoot(rootElement).render(<App />)
