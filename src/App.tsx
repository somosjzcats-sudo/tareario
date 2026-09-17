import { useState } from 'react'
import NavBar, { type Tab } from './components/NavBar'
import Sidebar from './components/Sidebar'
import ProfilePicker from './components/ProfilePicker'
import TodayView from './components/TodayView'
import WeekView from './components/WeekView'
import StatsView from './components/StatsView'
import SettingsView from './components/SettingsView'
import { useProfile } from './context/ProfileContext'
import { useData } from './context/DataContext'

export default function App() {
  const { me } = useProfile()
  const { error } = useData()
  const [tab, setTab] = useState<Tab>('hoy')

  if (!me) return <ProfilePicker />

  return (
    <div className="min-h-screen safe-top">
      <Sidebar active={tab} onChange={setTab} />
      <div className="md:pl-56">
        {error && (
          <div className="px-4 py-2 text-xs text-center" style={{ background: 'var(--color-danger)', color: '#0b1120' }}>
            Error cargando datos: {error}
          </div>
        )}
        {tab === 'hoy' && <TodayView />}
        {tab === 'semana' && <WeekView />}
        {tab === 'stats' && <StatsView />}
        {tab === 'ajustes' && <SettingsView />}
      </div>
      <NavBar active={tab} onChange={setTab} />
    </div>
  )
}
