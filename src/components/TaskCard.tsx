import { useState } from 'react'
import { ROOMS } from '../data/tasks'
import { PEOPLE_INFO } from '../context/ProfileContext'
import type { Occurrence, PersonId, TaskDef } from '../lib/types'

interface Props {
  occurrence: Occurrence
  task: TaskDef
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onReassign: (id: string, to: PersonId) => void
}

export default function TaskCard({ occurrence, task, onComplete, onUncomplete, onReassign }: Props) {
  const [swapping, setSwapping] = useState(false)
  const room = ROOMS[task.room] ?? { name: task.room, emoji: '🏷️' }
  const person = PEOPLE_INFO[occurrence.assignedTo]
  const isDone = occurrence.status === 'done'
  const isMissed = occurrence.status === 'missed'

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
        aria-label={isDone ? 'Marcar como pendiente' : 'Marcar como hecha'}
        onClick={() => (isDone ? onUncomplete(occurrence.id) : onComplete(occurrence.id))}
        className="mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 active:scale-90 transition"
        style={{ borderColor: isDone ? 'var(--color-accent)' : person.color, background: isDone ? 'var(--color-accent)' : 'transparent' }}
      >
        {isDone && <span className="text-[11px] text-black font-bold">✓</span>}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm">{room.emoji}</span>
          <span className={`text-sm font-medium ${isDone ? 'line-through' : ''}`}>{task.title}</span>
          <span className="text-[11px] text-[color:var(--color-text-dim)]">· {task.room}</span>
        </div>
        {task.detail && <p className="text-xs text-[color:var(--color-text-dim)] mt-0.5">{task.detail}</p>}
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--color-surface-2)', color: person.color }}
          >
            ● {person.name}
          </span>
          <span className="text-[11px] text-[color:var(--color-text-dim)]">{task.minutes} min</span>
          {isMissed && <span className="text-[11px] font-medium" style={{ color: 'var(--color-danger)' }}>Se pasó</span>}
          {isDone && occurrence.points > 0 && (
            <span className="text-[11px] font-medium" style={{ color: 'var(--color-accent)' }}>+{occurrence.points} pts</span>
          )}
        </div>
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
