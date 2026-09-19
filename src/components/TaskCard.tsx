import { useState } from 'react'
import { ROOMS } from '../data/tasks'
import { PEOPLE_INFO } from '../context/ProfileContext'
import type { OccurrenceAvailability } from '../context/DataContext'
import type { Occurrence, PersonId, TaskDef } from '../lib/types'

interface Props {
  occurrence: Occurrence
  task: TaskDef
  onComplete: (id: string) => void | Promise<void>
  onUncomplete: (id: string) => void
  onReassign: (id: string, to: PersonId) => void
  /** Ventana de disponibilidad de esta ocurrencia (adelanto/retraso permitido,
   * caducidad, si cae en vacaciones…). Si no se pasa, no se bloquea nada. */
  availability?: OccurrenceAvailability
}

export default function TaskCard({ occurrence, task, onComplete, onUncomplete, onReassign, availability }: Props) {
  const [swapping, setSwapping] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const room = ROOMS[task.room] ?? { name: task.room, emoji: '🏷️' }
  const person = PEOPLE_INFO[occurrence.assignedTo]
  const isDone = occurrence.status === 'done'
  const isMissed = occurrence.status === 'missed'
  const isLocked = !isDone && (isMissed || (availability ? !availability.ok : false))

  const lockTitle = isMissed
    ? task.frequency === 'daily'
      ? 'Diaria perdida: caducó a las 10:00 del día siguiente.'
      : 'Perdida: el plazo para hacerla ya terminó.'
    : availability?.reason === 'too-early'
      ? `Aún no toca. Se puede marcar desde el ${availability.window.earliestDate}.`
      : availability?.reason === 'expired'
        ? `Caducada. El plazo terminaba el ${availability.window.latestDate}.`
        : undefined

  async function handleToggle() {
    if (isDone) {
      onUncomplete(occurrence.id)
      return
    }
    if (isLocked) return
    setErr(null)
    try {
      await onComplete(occurrence.id)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo marcar como hecha.')
    }
  }

  return (
    <div
      className="rounded-xl border px-3 py-2.5 flex items-start gap-3"
      style={{
        background: 'var(--color-surface)',
        borderColor: isMissed ? 'var(--color-danger)' : 'var(--color-border)',
        opacity: isDone ? 0.65 : 1,
      }}
    >
      <button
        aria-label={isDone ? 'Marcar como pendiente' : isLocked ? 'No disponible' : 'Marcar como hecha'}
        onClick={handleToggle}
        disabled={isLocked}
        title={lockTitle}
        className="mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 active:scale-90 transition disabled:active:scale-100 disabled:cursor-not-allowed"
        style={{
          borderColor: isDone ? 'var(--color-accent)' : isLocked ? 'var(--color-border)' : person.color,
          background: isDone ? 'var(--color-accent)' : 'transparent',
          opacity: isLocked ? 0.55 : 1,
        }}
      >
        {isDone && <span className="text-[11px] text-black font-bold">✓</span>}
        {!isDone && isLocked && <span className="text-[9px]">{isMissed ? '✕' : '⏳'}</span>}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm">{room.emoji}</span>
          <span className={`text-sm font-medium ${isDone ? 'line-through' : ''}`}>{task.title}</span>
          <span className="text-[11px] text-[color:var(--color-text-dim)]">· {task.room}</span>
        </div>
        {task.detail && <p className="text-xs text-[color:var(--color-text-dim)] mt-0.5">{task.detail}</p>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span
            className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--color-surface-2)', color: person.color }}
          >
            ● {person.name}
          </span>
          <span className="text-[11px] text-[color:var(--color-text-dim)]">{task.minutes} min</span>
          {availability?.onVacation && !isDone && (
            <span className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>🌴 en vacaciones</span>
          )}
          {isMissed && <span className="text-[11px] font-medium" style={{ color: 'var(--color-danger)' }}>Perdida</span>}
          {!isMissed && !isDone && availability?.reason === 'too-early' && (
            <span className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>⏳ desde {availability.window.earliestDate}</span>
          )}
          {!isMissed && !isDone && availability && availability.ok && availability.window.lateFlexDays > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>hasta {availability.window.latestDate}</span>
          )}
          {isDone && occurrence.points > 0 && (
            <span className="text-[11px] font-medium" style={{ color: 'var(--color-accent)' }}>+{occurrence.points} pts</span>
          )}
        </div>
        {err && <p className="text-[11px] mt-1" style={{ color: 'var(--color-danger)' }}>⚠️ {err}</p>}
      </div>

      <div className="relative shrink-0">
        <button
          aria-label="Cambiar responsable"
          onClick={() => setSwapping((s) => !s)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm active:scale-90 transition"
          style={{ background: 'var(--color-surface-2)' }}
        >
          🔁
        </button>
        {swapping && (
          <div
            className="absolute right-0 top-9 z-10 rounded-lg border shadow-lg overflow-hidden"
            style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
          >
            {(['zaira', 'jef'] as PersonId[]).map((pid) => (
              <button
                key={pid}
                onClick={() => {
                  onReassign(occurrence.id, pid)
                  setSwapping(false)
                }}
                className="block w-full text-left px-3 py-2 text-xs whitespace-nowrap"
                style={{ color: PEOPLE_INFO[pid].color }}
              >
                Asignar a {PEOPLE_INFO[pid].name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
