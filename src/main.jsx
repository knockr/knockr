import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import KnockrApp from '../knockr.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <KnockrApp />
  </StrictMode>,
)
