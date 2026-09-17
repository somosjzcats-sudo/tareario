import type { Occurrence, PersonId, TaskDef } from './types'
import { isWeekend } from './schedule'

export const PENALTY_PER_MISSED = 5
export const STREAK_BONUS_STEP = 7 // cada 7 días de racha, +1 punto extra por tarea
export const WEEKEND_BONUS = 2 // puntos extra por completar algo en fin de semana (compensa el esfuerzo)

export function pointsForOccurrence(minutes: number, dateStr: string, currentStreak: number): number {
  const base = Math.max(1, Math.round(minutes / 2))
  const streakBonus = Math.floor(currentStreak / STREAK_BONUS_STEP)
  const weekendBonus = isWeekend(dateStr) ? WEEKEND_BONUS : 0
  return base + streakBonus + weekendBonus
}

export interface PersonStats {
  person: PersonId
  totalPoints: number
  completed: number
  missed: number
  pending: number
  completionRate: number // 0-1 sobre tareas ya vencidas (done+missed)
  currentStreak: number // días consecutivos con 0 pendientes/perdidas hasta hoy
  bestStreak: number
  totalMinutes: number
}

/** Días consecutivos (terminando hoy o ayer) en los que la persona no dejó
 * ninguna tarea asignada sin completar (missed). */
function computeStreaks(occurrences: Occurrence[], person: PersonId, todayStr: string) {
  const byDate = new Map<string, Occurrence[]>()
  for (const o of occurrences) {
    if (o.assignedTo !== person) continue
    if (!byDate.has(o.date)) byDate.set(o.date, [])
    byDate.get(o.date)!.push(o)
  }
  const dates = [...byDate.keys()].filter((d) => d <= todayStr).sort()
  let current = 0
  let best = 0
  let running = 0
  for (const d of dates) {
    const items = byDate.get(d)!
    const hasPending = items.some((o) => o.status === 'pending' && d < todayStr)
    const hasMissed = items.some((o) => o.status === 'missed')
    const clean = !hasPending && !hasMissed && items.length > 0
    if (clean) {
      running += 1
      best = Math.max(best, running)
    } else if (items.length > 0) {
      running = 0
    }
  }
  // ¿la racha llega hasta hoy/ayer? recalculamos desde el final hacia atrás
  current = 0
  for (let i = dates.length - 1; i >= 0; i--) {
    const d = dates[i]
    const items = byDate.get(d)!
    const hasPending = items.some((o) => o.status === 'pending' && d < todayStr)
    const hasMissed = items.some((o) => o.status === 'missed')
    const clean = !hasPending && !hasMissed
    if (clean) current += 1
    else break
  }
  return { current, best }
}

export function computeStats(
  occurrences: Occurrence[],
  tasksById: Map<string, TaskDef>,
  person: PersonId,
  todayStr: string,
): PersonStats {
  const mine = occurrences.filter((o) => o.assignedTo === person)
  const completed = mine.filter((o) => o.status === 'done').length
  const missed = mine.filter((o) => o.status === 'missed').length
  const pending = mine.filter((o) => o.status === 'pending').length
  const due = completed + missed
  const totalPoints = mine.reduce((sum, o) => sum + (o.status === 'done' ? o.points : o.status === 'missed' ? -PENALTY_PER_MISSED : 0), 0)
  const totalMinutes = mine
    .filter((o) => o.status === 'done')
    .reduce((sum, o) => sum + (tasksById.get(o.taskId)?.minutes ?? 0), 0)
  const { current, best } = computeStreaks(occurrences, person, todayStr)
  return {
    person,
    totalPoints,
    completed,
    missed,
    pending,
    completionRate: due > 0 ? completed / due : 1,
    currentStreak: current,
    bestStreak: best,
    totalMinutes,
  }
}

export interface Badge {
  id: string
  label: string
  emoji: string
  description: string
}

export function badgesFor(stats: PersonStats): Badge[] {
  const badges: Badge[] = []
  if (stats.currentStreak >= 3) badges.push({ id: 'streak3', label: 'En racha', emoji: '🔥', description: '3+ días seguidos sin dejar tareas pendientes' })
  if (stats.currentStreak >= 7) badges.push({ id: 'streak7', label: 'Semana perfecta', emoji: '🏅', description: '7+ días seguidos al día' })
  if (stats.currentStreak >= 30) badges.push({ id: 'streak30', label: 'Imparable', emoji: '👑', description: '30+ días seguidos al día' })
  if (stats.completionRate >= 0.95 && stats.completed + stats.missed >= 10) badges.push({ id: 'reliable', label: 'De fiar', emoji: '✅', description: '95%+ de tareas completadas' })
  if (stats.missed === 0 && stats.completed >= 20) badges.push({ id: 'flawless', label: 'Sin fallos', emoji: '💎', description: 'Ninguna tarea perdida' })
  return badges
}
