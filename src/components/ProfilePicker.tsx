import { PEOPLE_INFO, useProfile } from '../context/ProfileContext'
import type { PersonId } from '../lib/types'

export default function ProfilePicker() {
  const { setMe } = useProfile()
  const ids: PersonId[] = ['zaira', 'jef']

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 safe-top safe-bottom">
      <div className="text-center space-y-2">
        <div className="text-4xl">🏠✨</div>
        <h1 className="text-2xl font-semibold">Casa Tareas</h1>
        <p className="text-[color:var(--color-text-dim)] text-sm">¿Quién eres tú en este dispositivo?</p>
      </div>
      <div className="flex gap-4 w-full max-w-sm">
        {ids.map((id) => {
          const p = PEOPLE_INFO[id]
          return (
            <button
              key={id}
              onClick={() => setMe(id)}
              className="flex-1 rounded-2xl border py-8 flex flex-col items-center gap-3 active:scale-95 transition"
              style={{ borderColor: p.color, background: 'var(--color-surface)' }}
            >
              <span
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
                style={{ background: p.color, color: '#0b1120' }}
              >
                {p.name.slice(0, 1)}
              </span>
              <span className="font-medium">{p.name}</span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-[color:var(--color-text-dim)] text-center max-w-xs">
        Esto solo elige qué ves marcado como "tuyo" en este móvil u ordenador. Podéis cambiarlo luego en Ajustes.
      </p>
    </div>
  )
}
