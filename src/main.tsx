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

if ('serviceWorker' in navigator && import.meta.env.PROD && !isLocalhost) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // ignore registration failure
    })
  })
}
