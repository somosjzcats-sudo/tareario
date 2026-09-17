import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ProfileProvider } from './context/ProfileContext'
import { DataProvider } from './context/DataContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProfileProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </ProfileProvider>
  </StrictMode>,
)
