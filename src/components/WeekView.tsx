import { addDays, format, isToday, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { PEOPLE_INFO, useProfile } from '../context/ProfileContext'
import TaskCard from './TaskCard'

export default function WeekView() {
  const { occurrences, tasksById, availabilityById, completeOccurrence, uncompleteOccurrence, reassignOccurrence } = useData()
  const { me } = useProfile()
  const [weekOffset, setWeekOffset] = useState(0)
  const [openDay, setOpenDay] = useState<string | null>(format(new Date(), 'yyyy-MM-dd'))

  const weekStart = useMemo(() => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7), [weekOffset])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const byDate = useMemo(() => {
    const map = new Map<string, typeof occurrences>()
    for (const d of days) map.set(format(d, 'yyyy-MM-dd'), [])
    for (const o of occurrences) {
      if (map.has(o.date)) map.get(o.date)!.push(o)
    }
    return map
  }, [occurrences, days])

  return (
    <div className="px-4 md:px-8 pt-4 md:pt-8 pb-24 md:pb-10 max-w-md md:max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <button onClick={() => setWeekOffset((w) => w - 1)} className="w-9 h-9 rounded-lg" style={{ background: 'var(--color-surface)' }}>‹</button>
        <div className="text-center">
          <h1 className="text-base font-semibold capitalize">
            {format(weekStart, "d MMM", { locale: es })} – {format(addDays(weekStart, 6), "d MMM", { locale: es })}
          </h1>
          {weekOffset !== 0 && (
            <button className="text-[11px] text-[color:var(--color-accent)]" onClick={() => setWeekOffset(0)}>Volver a esta semana</button>
          )}
        </div>
        <button onClick={() => setWeekOffset((w) => w + 1)} className="w-9 h-9 rounded-lg" style={{ background: 'var(--color-surface)' }}>›</button>
      </header>

      <div className="space-y-2">
        {days.map((d) => {
          const dateStr = format(d, 'yyyy-MM-dd')
          const items = byDate.get(dateStr) ?? []
          const isOpen = openDay === dateStr
          const weekend = d.getDay() === 0 || d.getDay() === 6
          const minutesByPerson = { zaira: 0, jef: 0 }
          for (const o of items) minutesByPerson[o.assignedTo] += tasksById.get(o.taskId)?.minutes ?? 0
          const doneCount = items.filter((o) => o.status === 'done').length

          return (
            <div key={dateStr} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <button
                onClick={() => setOpenDay(isOpen ? null : dateStr)}
                className="w-full flex items-center justify-between px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium capitalize ${isToday(d) ? '' : ''}`} style={{ color: isToday(d) ? 'var(--color-accent)' : undefined }}>
                    {format(d, 'EEEE d', { locale: es })}
                  </span>
                  {weekend && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-dim)' }}>fin de semana</span>}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[color:var(--color-text-dim)]">
                  <span>{doneCount}/{items.length}</span>
                  <span style={{ color: PEOPLE_INFO.zaira.color }}>{minutesByPerson.zaira}m</span>
                  <span style={{ color: PEOPLE_INFO.jef.color }}>{minutesByPerson.jef}m</span>
                  <span>{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>
              {isOpen && (
                <div className="px-2 pb-2 space-y-1.5">
                  {items.length === 0 && <p className="text-xs text-[color:var(--color-text-dim)] italic px-2 pb-2">Sin tareas.</p>}
                  {items
                    .sort((a, b) => (a.assignedTo === b.assignedTo ? 0 : a.assignedTo === 'zaira' ? -1 : 1))
                    .map((o) => {
                      const t = tasksById.get(o.taskId)
                      if (!t) return null
                      return (
                        <TaskCard
                          key={o.id}
                          occurrence={o}
                          task={t}
                          availability={availabilityById.get(o.id)}
                          onComplete={(id) => completeOccurrence(id, me ?? o.assignedTo)}
                          onUncomplete={uncompleteOccurrence}
                          onReassign={reassignOccurrence}
                        />
                      )
                    })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
