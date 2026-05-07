import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

const isLocalhost =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV || isLocalhost) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => {
            // ignore unregister failure
          })
        })
      })
    })
  } else if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // ignore registration failure
      })
    })
  }
}
