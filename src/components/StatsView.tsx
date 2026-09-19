import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useData, todayStr } from '../context/DataContext'
import { badgesFor, computeMissedBreakdown, computeStats, currentWeekMinutes, recentMissed } from '../lib/gamification'
import { PEOPLE_INFO } from '../context/ProfileContext'
import type { PersonId } from '../lib/types'

const PEOPLE: PersonId[] = ['zaira', 'jef']

export default function StatsView() {
  const { statsOccurrences, statsStartDate, tasksById, weeklyTarget, resetStatsFrom, clearStatsReset } = useData()
  const today = todayStr()

  const stats = useMemo(() => PEOPLE.map((p) => computeStats(statsOccurrences, tasksById, p, today)), [statsOccurrences, tasksById, today])

  // "Hoy" es aparte del % de completadas a tiempo: ese % solo cuenta lo que
  // ya venció (hecho o perdido), así que una tarea de hoy que todavía tiene
  // margen no cuenta ni a favor ni en contra todavía. Mostramos las dos
  // cosas por separado para que no parezca contradictorio (100% completadas
  // pero con tareas de hoy aún sin marcar).
  const todayCounts = useMemo(() => {
    const result: Record<PersonId, { done: number; total: number }> = {
      zaira: { done: 0, total: 0 },
      jef: { done: 0, total: 0 },
    }
    for (const o of statsOccurrences) {
      if (o.date !== today) continue
      result[o.assignedTo].total += 1
      if (o.status === 'done') result[o.assignedTo].done += 1
    }
    return result
  }, [statsOccurrences, today])

  const missedBreakdown = useMemo(
    () => Object.fromEntries(PEOPLE.map((p) => [p, computeMissedBreakdown(statsOccurrences, tasksById, p)])) as Record<PersonId, ReturnType<typeof computeMissedBreakdown>>,
    [statsOccurrences, tasksById],
  )
  const recentMissedByPerson = useMemo(
    () => Object.fromEntries(PEOPLE.map((p) => [p, recentMissed(statsOccurrences, tasksById, p, 6)])) as Record<PersonId, ReturnType<typeof recentMissed>>,
    [statsOccurrences, tasksById],
  )

  const weekMinutes = useMemo(() => currentWeekMinutes(statsOccurrences, tasksById, today), [statsOccurrences, tasksById, today])
  const weekTotal = weekMinutes.zaira + weekMinutes.jef
  const weekDiff = Math.abs(weekMinutes.zaira - weekMinutes.jef)

  const pointsData = stats.map((s) => ({ name: PEOPLE_INFO[s.person].name, puntos: s.totalPoints, color: PEOPLE_INFO[s.person].color }))

  const weekMinutesData = PEOPLE.map((p) => ({ name: PEOPLE_INFO[p].name, minutos: weekMinutes[p], color: PEOPLE_INFO[p].color }))

  const last14 = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => subDays(new Date(), 13 - i))
    return days.map((d) => {
      const dateStr = format(d, 'yyyy-MM-dd')
      const row: Record<string, string | number> = { date: format(d, 'd MMM', { locale: es }) }
      for (const p of PEOPLE) {
        row[p] = statsOccurrences
          .filter((o) => o.date === dateStr && o.assignedTo === p && o.status === 'done')
          .reduce((s, o) => s + (tasksById.get(o.taskId)?.minutes ?? 0), 0)
      }
      return row
    })
  }, [statsOccurrences, tasksById])

  async function handleResetToday() {
    if (!confirm('¿Reiniciar contadores y estadísticas para que cuenten solo desde hoy? El historial de antes se sigue viendo día a día en Semana, pero deja de contar en puntos, rachas y perdidas.')) return
    await resetStatsFrom()
  }

  return (
    <div className="px-4 md:px-8 pt-4 md:pt-8 pb-24 md:pb-10 max-w-md md:max-w-3xl mx-auto">
      <header className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Estadísticas</h1>
          <p className="text-xs text-[color:var(--color-text-dim)]">Constancia y reparto entre los dos</p>
        </div>
        <button
          onClick={handleResetToday}
          className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg shrink-0"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-dim)' }}
        >
          🔄 Reiniciar desde hoy
        </button>
      </header>

      {statsStartDate && (
        <div
          className="rounded-lg border px-3 py-2 mb-4 text-[11px] flex items-center justify-between gap-2 flex-wrap"
          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
        >
          <span>📊 Contando desde el {statsStartDate}. Lo de antes se sigue viendo en Semana pero ya no cuenta aquí.</span>
          <button onClick={() => void clearStatsReset()} className="underline shrink-0">Contar todo el historial</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-5">
        {stats.map((s) => {
          const badges = badgesFor(s)
          const p = PEOPLE_INFO[s.person]
          return (
            <div key={s.person} className="rounded-xl border p-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: p.color }}>{p.name}</p>
              <p className="text-2xl font-bold leading-none">{s.totalPoints}<span className="text-xs font-normal text-[color:var(--color-text-dim)]"> pts</span></p>

              <div className="mt-2 mb-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[color:var(--color-text-dim)]">📆 hoy</span>
                  <span className="text-[11px] text-[color:var(--color-text-dim)]">{todayCounts[s.person].done}/{todayCounts[s.person].total}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--color-surface-2)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${todayCounts[s.person].total > 0 ? Math.round((todayCounts[s.person].done / todayCounts[s.person].total) * 100) : 100}%`,
                      background: p.color,
                    }}
                  />
                </div>
              </div>

              <p className="text-[11px] text-[color:var(--color-text-dim)]">🔥 racha: {s.currentStreak} días (mejor {s.bestStreak})</p>
              <p
                className="text-[11px] text-[color:var(--color-text-dim)]"
                title="Solo cuenta lo que ya venció (hecho o perdido). Lo de hoy que todavía tiene margen no entra aquí hasta que se cumpla o se pase el plazo."
              >
                ✅ {Math.round(s.completionRate * 100)}% a tiempo (de lo ya vencido)
              </p>
              <p className="text-[11px] text-[color:var(--color-text-dim)]">❌ {s.missed} perdidas</p>
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {badges.map((b) => (
                    <span key={b.id} title={b.description} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-surface-2)' }}>
                      {b.emoji} {b.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-[color:var(--color-text-dim)] uppercase tracking-wide mb-2">Minutos asignados esta semana</h2>
        <div className="rounded-xl border p-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-[11px] text-[color:var(--color-text-dim)] mb-2">
            {weekTotal > 0
              ? `Diferencia de ${weekDiff} min entre los dos esta semana (objetivo: lo más parecido posible).`
              : 'Todavía no hay tareas asignadas esta semana.'}
          </p>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={weekMinutesData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--color-border)" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fill: 'var(--color-text-dim)', fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="minutos" radius={[0, 6, 6, 0]} maxBarSize={28} label={{ position: 'right', fill: 'var(--color-text)', fontSize: 12 }}>
                {weekMinutesData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {weeklyTarget.biased && (
            <div className="mt-1 rounded-lg px-2.5 py-2 text-[11px]" style={{ background: 'var(--color-surface-2)' }}>
              ⚖️ Reparto ajustado este ciclo: objetivo {Math.round(weeklyTarget.share.zaira * 100)}% Zaira /{' '}
              {Math.round(weeklyTarget.share.jef * 100)}% Jef, porque{' '}
              {weeklyTarget.badStreak.zaira > weeklyTarget.badStreak.jef
                ? `Zaira lleva ${weeklyTarget.badStreak.zaira} semana(s) floja(s) seguida(s)`
                : `Jef lleva ${weeklyTarget.badStreak.jef} semana(s) floja(s) seguida(s)`}{' '}
              (menos del 75% de tareas completadas a tiempo): como penalización, le toca algo más de carga la próxima semana, hasta que recupere el ritmo.
            </div>
          )}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-[color:var(--color-text-dim)] uppercase tracking-wide mb-2">Tareas perdidas: análisis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PEOPLE.map((p) => {
            const b = missedBreakdown[p]
            const recent = recentMissedByPerson[p]
            const p_ = PEOPLE_INFO[p]
            return (
              <div key={p} className="rounded-xl border p-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: p_.color }}>{p_.name} · {b.total} perdida{b.total === 1 ? '' : 's'} en total</p>
                {b.total > 0 ? (
                  <div className="flex gap-3 mb-2 text-[11px] text-[color:var(--color-text-dim)]">
                    <span>🔁 diarias: {b.daily}</span>
                    <span>📅 semanales: {b.weekly}</span>
                    <span>🗓️ mensuales: {b.monthly}</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-[color:var(--color-text-dim)] mb-2">Ninguna perdida. 🎉</p>
                )}
                {recent.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {recent.map((m) => (
                      <li key={m.occurrenceId} className="text-[11px] text-[color:var(--color-text-dim)] flex items-center justify-between gap-2">
                        <span className="truncate">{m.title}{m.room ? ` · ${m.room}` : ''}</span>
                        <span className="shrink-0">{m.date}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-[color:var(--color-text-dim)] uppercase tracking-wide mb-2">Puntos totales</h2>
        <div className="rounded-xl border p-2" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={pointsData} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--color-text-dim)', fontSize: 12 }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="puntos" radius={[6, 6, 0, 0]} maxBarSize={56} label={{ position: 'top', fill: 'var(--color-text)', fontSize: 12 }}>
                {pointsData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[color:var(--color-text-dim)] uppercase tracking-wide mb-2">Minutos completados (últimos 14 días)</h2>
        <div className="rounded-xl border p-2" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={last14} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--color-text-dim)', fontSize: 10 }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} interval={2} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="zaira" name={PEOPLE_INFO.zaira.name} stroke={PEOPLE_INFO.zaira.color} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="jef" name={PEOPLE_INFO.jef.name} stroke={PEOPLE_INFO.jef.color} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center pb-1">
            {PEOPLE.map((p) => (
              <span key={p} className="text-[11px] flex items-center gap-1" style={{ color: PEOPLE_INFO[p].color }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: PEOPLE_INFO[p].color }} /> {PEOPLE_INFO[p].name}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
