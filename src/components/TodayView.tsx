import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useMemo } from 'react'
import { useData, todayStr } from '../context/DataContext'
import { PEOPLE_INFO, useProfile } from '../context/ProfileContext'
import TaskCard from './TaskCard'
import type { PersonId } from '../lib/types'

export default function TodayView() {
  const { occurrences, tasksById, availabilityById, completeOccurrence, uncompleteOccurrence, reassignOccurrence, loading } = useData()
  const { me } = useProfile()
  const today = todayStr()

  const todays = useMemo(() => occurrences.filter((o) => o.date === today), [occurrences, today])

  const mine = todays.filter((o) => o.assignedTo === me)
  const theirs = todays.filter((o) => o.assignedTo !== me)

  const summary = (list: typeof todays) => {
    const total = list.length
    const done = list.filter((o) => o.status === 'done').length
    const minutes = list.reduce((s, o) => s + (tasksById.get(o.taskId)?.minutes ?? 0), 0)
    const minutesDone = list.filter((o) => o.status === 'done').reduce((s, o) => s + (tasksById.get(o.taskId)?.minutes ?? 0), 0)
    return { total, done, minutes, minutesDone }
  }

  const mySummary = summary(mine)
  const partnerId: PersonId | undefined = me === 'zaira' ? 'jef' : me === 'jef' ? 'zaira' : undefined
  const partnerSummary = summary(theirs)

  const dateLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: es })

  return (
    <div className="px-4 md:px-8 pt-4 md:pt-8 pb-24 md:pb-10 max-w-md md:max-w-4xl mx-auto">
      <header className="mb-4">
        <p className="text-xs text-[color:var(--color-text-dim)] capitalize">{dateLabel}</p>
        <h1 className="text-xl font-semibold">Hoy</h1>
      </header>

      {loading && <p className="text-sm text-[color:var(--color-text-dim)]">Cargando…</p>}

      {me && (
        <div className="grid grid-cols-2 md:max-w-md gap-3 mb-5">
          <SummaryCard title="Tú" color={PEOPLE_INFO[me].color} done={mySummary.done} total={mySummary.total} minutesDone={mySummary.minutesDone} minutes={mySummary.minutes} />
          {partnerId && (
            <SummaryCard
              title={PEOPLE_INFO[partnerId].name}
              color={PEOPLE_INFO[partnerId].color}
              done={partnerSummary.done}
              total={partnerSummary.total}
              minutesDone={partnerSummary.minutesDone}
              minutes={partnerSummary.minutes}
            />
          )}
        </div>
      )}

      <div className="md:grid md:grid-cols-2 md:gap-6 md:items-start">
      <section className="space-y-2 mb-6">
        <h2 className="text-sm font-semibold text-[color:var(--color-text-dim)] uppercase tracking-wide">Tus tareas</h2>
        {mine.length === 0 && <EmptyNote text="Nada asignado a ti hoy. 🎉" />}
        {mine
          .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))
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
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[color:var(--color-text-dim)] uppercase tracking-wide">
          Tareas de {partnerId ? PEOPLE_INFO[partnerId].name : 'la otra persona'}
        </h2>
        {theirs.length === 0 && <EmptyNote text="Sin tareas asignadas hoy." />}
        {theirs
          .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))
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
      </section>
      </div>
    </div>
  )
}

function SummaryCard({ title, color, done, total, minutesDone, minutes }: { title: string; color: string; done: number; total: number; minutesDone: number; minutes: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 100
  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color }}>{title}</span>
        <span className="text-xs text-[color:var(--color-text-dim)]">{done}/{total}</span>
      </div>
      <div className="h-1.5 rounded-full mb-1.5" style={{ background: 'var(--color-surface-2)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-[11px] text-[color:var(--color-text-dim)]">{minutesDone} / {minutes} min</p>
    </div>
  )
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-xs text-[color:var(--color-text-dim)] italic py-2">{text}</p>
}
