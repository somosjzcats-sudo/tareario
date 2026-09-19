import { useState } from 'react'
import NavBar, { type Tab } from './components/NavBar'
import Sidebar from './components/Sidebar'
import ProfilePicker from './components/ProfilePicker'
import Login from './components/Login'
import TodayView from './components/TodayView'
import WeekView from './components/WeekView'
import StatsView from './components/StatsView'
import SettingsView from './components/SettingsView'
import { useProfile } from './context/ProfileContext'
import { useData } from './context/DataContext'
import { useAuth } from './context/AuthContext'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="text-sm text-[color:var(--color-text-dim)]">Cargando…</span>
    </div>
  )
}

export default function App() {
  const { me } = useProfile()
  const { error } = useData()
  const { requiresLogin, loading: authLoading, session, authPerson, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('hoy')

  if (requiresLogin) {
    if (authLoading) return <Spinner />
    if (!session) return <Login />
    if (!authPerson) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center safe-top safe-bottom">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-semibold">Cuenta sin configurar</h1>
          <p className="text-sm text-[color:var(--color-text-dim)] max-w-sm">
            Tu cuenta ha iniciado sesión pero no tiene asignado a quién pertenece (Zaira o Jef). Pide a quien
            configuró Supabase que añada <code>person: "zaira"</code> o <code>person: "jef"</code> en los metadatos
            del usuario.
          </p>
          <p className="text-xs text-[color:var(--color-text-dim)] max-w-sm">
            Si ya lo has arreglado en Supabase, cierra sesión y vuelve a entrar — los metadatos solo se leen de
            nuevo al iniciar sesión, no se actualizan solos mientras estás dentro.
          </p>
          <button
            onClick={() => void signOut()}
            className="mt-1 text-sm font-medium px-4 py-2 rounded-lg"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)' }}
          >
            Cerrar sesión
          </button>
        </div>
      )
    }
  } else if (!me) {
    return <ProfilePicker />
  }

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
