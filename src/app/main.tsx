import './migrateStorageKeys'
import '../lib/installPrompt'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import App from './App'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root was not found.')

const root = rootElement
function start() {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

start()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Unable to register the offline app worker:', error)
    })
  }, { once: true })
}
