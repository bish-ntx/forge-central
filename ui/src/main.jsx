import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { RoleProvider } from './context/RoleContext.jsx'
import { TimezoneProvider } from './context/TimezoneContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <TimezoneProvider>
        <RoleProvider>
          <App />
        </RoleProvider>
      </TimezoneProvider>
    </BrowserRouter>
  </StrictMode>,
)
