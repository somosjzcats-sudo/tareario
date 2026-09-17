export type Tab = 'hoy' | 'semana' | 'stats' | 'ajustes'

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'hoy', label: 'Hoy', emoji: '📋' },
  { id: 'semana', label: 'Semana', emoji: '🗓️' },
  { id: 'stats', label: 'Stats', emoji: '📊' },
  { id: 'ajustes', label: 'Ajustes', emoji: '⚙️' },
]

export default function NavBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around border-t safe-bottom z-20"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {TABS.map((t) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition"
            style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-dim)' }}
          >
            <span className="text-lg leading-none">{t.emoji}</span>
            <span className={isActive ? 'font-semibold' : ''}>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
