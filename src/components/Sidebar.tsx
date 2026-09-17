import type { Tab } from './NavBar'
import { PEOPLE_INFO, useProfile } from '../context/ProfileContext'

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'hoy', label: 'Hoy', emoji: '📋' },
  { id: 'semana', label: 'Semana', emoji: '🗓️' },
  { id: 'stats', label: 'Estadísticas', emoji: '📊' },
  { id: 'ajustes', label: 'Ajustes', emoji: '⚙️' },
]

export default function Sidebar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const { me } = useProfile()

  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 bottom-0 w-56 flex-col border-r px-4 py-6 z-20"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-2 mb-8 px-1">
        <span className="text-2xl">🏠</span>
        <span className="font-semibold">Casa Tareas</span>
      </div>

      <nav className="flex flex-col gap-1">
        {TABS.map((t) => {
          const isActive = t.id === active
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-left transition"
              style={{
                background: isActive ? 'var(--color-surface-2)' : 'transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-dim)',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <span className="text-base">{t.emoji}</span>
              {t.label}
            </button>
          )
        })}
      </nav>

      {me && (
        <div className="mt-auto flex items-center gap-2 px-1 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: PEOPLE_INFO[me].color, color: '#0b1120' }}
          >
            {PEOPLE_INFO[me].name.slice(0, 1)}
          </span>
          <span className="text-xs text-[color:var(--color-text-dim)]">Conectado como {PEOPLE_INFO[me].name}</span>
        </div>
      )}
    </aside>
  )
}
