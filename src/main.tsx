import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'line-awesome/dist/line-awesome/css/line-awesome.min.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
