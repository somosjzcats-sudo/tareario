import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useData, todayStr } from '../context/DataContext'
import { badgesFor, computeStats, currentWeekMinutes } from '../lib/gamification'
import { PEOPLE_INFO } from '../context/ProfileContext'
import type { PersonId } from '../lib/types'

const PEOPLE: PersonId[] = ['zaira', 'jef']

export default function StatsView() {
  const { occurrences, tasksById, weeklyTarget } = useData()
  const today = todayStr()

  const stats = useMemo(() => PEOPLE.map((p) => computeStats(occurrences, tasksById, p, today)), [occurrences, tasksById, today])

  const weekMinutes = useMemo(() => currentWeekMinutes(occurrences, tasksById, today), [occurrences, tasksById, today])
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
        row[p] = occurrences
          .filter((o) => o.date === dateStr && o.assignedTo === p && o.status === 'done')
          .reduce((s, o) => s + (tasksById.get(o.taskId)?.minutes ?? 0), 0)
      }
      return row
    })
  }, [occurrences, tasksById])

  return (
    <div className="px-4 md:px-8 pt-4 md:pt-8 pb-24 md:pb-10 max-w-md md:max-w-3xl mx-auto">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Estadísticas</h1>
        <p className="text-xs text-[color:var(--color-text-dim)]">Constancia y reparto entre los dos</p>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {stats.map((s) => {
          const badges = badgesFor(s)
          const p = PEOPLE_INFO[s.person]
          return (
            <div key={s.person} className="rounded-xl border p-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: p.color }}>{p.name}</p>
              <p className="text-2xl font-bold leading-none">{s.totalPoints}<span className="text-xs font-normal text-[color:var(--color-text-dim)]"> pts</span></p>
              <p className="text-[11px] text-[color:var(--color-text-dim)] mt-1">🔥 racha: {s.currentStreak} días (mejor {s.bestStreak})</p>
              <p className="text-[11px] text-[color:var(--color-text-dim)]">✅ {Math.round(s.completionRate * 100)}% completadas</p>
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
