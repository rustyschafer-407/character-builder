import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyDisplayPreferences, readDisplayPreferences } from './lib/displayPreferences'

applyDisplayPreferences(readDisplayPreferences())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
