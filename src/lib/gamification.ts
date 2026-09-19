import type { Occurrence, PersonId, TaskDef } from './types'
import { isWeekend, mondayOf, weekKeyOf } from './schedule'
import { addWeeks, format } from 'date-fns'

export const PENALTY_PER_MISSED = 5
export const STREAK_BONUS_STEP = 7 // cada 7 días de racha, +1 punto extra por tarea
export const WEEKEND_BONUS = 2 // puntos extra por completar algo en fin de semana (compensa el esfuerzo)

// --- Objetivo semanal y penalización por semanas flojas ---
export const BAD_WEEK_THRESHOLD = 0.75 // menos del 75% completado a tiempo = "semana floja"
export const MAX_BAD_STREAK = 3 // a partir de aquí no se penaliza más
export const SHIFT_PER_BAD_WEEK = 0.08 // 8 puntos porcentuales de carga extra por cada semana floja consecutiva
export const MAX_SHIFT = 0.24 // tope de desvío (se aplica antes de dividir entre 2): con esto, el reparto llega como mucho a 62/38

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

// ---------------- Semanas: minutos asignados, cumplimiento y penalización ----------------

export interface WeekSummary {
  weekKey: string // lunes de esa semana, yyyy-MM-dd
  assignedMinutes: number
  completed: number
  missed: number
  completionRate: number // sobre tareas ya vencidas esa semana (done+missed); 1 si no había ninguna
}

/** Resumen semana a semana (por lunes) de lo asignado a `person`, usando los
 * minutos del catálogo (no los puntos). Incluye semanas futuras (asignadas
 * pero aún pendientes) además de las ya pasadas. */
export function weeklySummaries(occurrences: Occurrence[], tasksById: Map<string, TaskDef>, person: PersonId): Map<string, WeekSummary> {
  const map = new Map<string, WeekSummary>()
  for (const o of occurrences) {
    if (o.assignedTo !== person) continue
    const wk = weekKeyOf(o.date)
    const minutes = tasksById.get(o.taskId)?.minutes ?? 0
    if (!map.has(wk)) map.set(wk, { weekKey: wk, assignedMinutes: 0, completed: 0, missed: 0, completionRate: 1 })
    const s = map.get(wk)!
    s.assignedMinutes += minutes
    if (o.status === 'done') s.completed += 1
    if (o.status === 'missed') s.missed += 1
  }
  for (const s of map.values()) {
    const due = s.completed + s.missed
    s.completionRate = due > 0 ? s.completed / due : 1
  }
  return map
}

/** Minutos asignados esta semana (lunes-domingo actual) a cada persona —
 * la cifra clave para juzgar si el reparto está siendo justo, según pediste:
 * es más fácil ajustar mirando el total semanal que el día a día. */
export function currentWeekMinutes(occurrences: Occurrence[], tasksById: Map<string, TaskDef>, todayStr: string): Record<PersonId, number> {
  const wk = weekKeyOf(todayStr)
  const zaira = weeklySummaries(occurrences, tasksById, 'zaira').get(wk)?.assignedMinutes ?? 0
  const jef = weeklySummaries(occurrences, tasksById, 'jef').get(wk)?.assignedMinutes ?? 0
  return { zaira, jef }
}

/** Cuenta cuántas semanas SEGUIDAS (terminadas, hacia atrás desde la semana
 * anterior a la actual) ha estado `person` por debajo de BAD_WEEK_THRESHOLD.
 * Una semana sin ninguna tarea vencida no cuenta ni rompe la racha (no hay
 * datos para juzgarla). */
export function computeBadWeekStreak(occurrences: Occurrence[], tasksById: Map<string, TaskDef>, person: PersonId, todayStr: string): number {
  const summaries = weeklySummaries(occurrences, tasksById, person)
  let cursor = mondayOf(new Date(todayStr + 'T00:00:00'))
  cursor = addWeeks(cursor, -1) // empezamos por la última semana ya terminada
  let streak = 0
  for (let i = 0; i < MAX_BAD_STREAK + 2; i++) {
    const key = format(cursor, 'yyyy-MM-dd')
    const s = summaries.get(key)
    if (!s || s.completed + s.missed === 0) break // sin datos esa semana: paramos aquí
    if (s.completionRate < BAD_WEEK_THRESHOLD) {
      streak += 1
      cursor = addWeeks(cursor, -1)
    } else {
      break
    }
  }
  return Math.min(streak, MAX_BAD_STREAK)
}

// ---------------- Análisis de tareas perdidas ----------------

export interface MissedBreakdown {
  total: number
  daily: number
  weekly: number
  monthly: number
}

/** Desglose de tareas perdidas por frecuencia, para poder analizar si el
 * problema son las diarias (más exigentes, sin margen) o más bien las
 * semanales/mensuales. */
export function computeMissedBreakdown(occurrences: Occurrence[], tasksById: Map<string, TaskDef>, person: PersonId): MissedBreakdown {
  const missed = occurrences.filter((o) => o.assignedTo === person && o.status === 'missed')
  const result: MissedBreakdown = { total: missed.length, daily: 0, weekly: 0, monthly: 0 }
  for (const o of missed) {
    const freq = tasksById.get(o.taskId)?.frequency
    if (freq === 'daily') result.daily += 1
    else if (freq === 'weekly') result.weekly += 1
    else if (freq === 'monthly') result.monthly += 1
  }
  return result
}

export interface MissedItem {
  occurrenceId: string
  title: string
  room: string
  date: string
}

/** Últimas tareas perdidas (más recientes primero), para revisar el detalle
 * en vez de solo el número total. */
export function recentMissed(
  occurrences: Occurrence[],
  tasksById: Map<string, TaskDef>,
  person: PersonId,
  limit = 8,
): MissedItem[] {
  return occurrences
    .filter((o) => o.assignedTo === person && o.status === 'missed')
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit)
    .map((o) => {
      const t = tasksById.get(o.taskId)
      return { occurrenceId: o.id, title: t?.title ?? '(tarea eliminada)', room: t?.room ?? '', date: o.date }
    })
}

export interface WeeklyTargetInfo {
  share: Record<PersonId, number> // suma 1
  badStreak: Record<PersonId, number>
  biased: boolean
}

/** Reparto objetivo de minutos semanales entre las dos personas. Por
 * defecto 50/50; si alguien lleva semanas flojas seguidas, se desvía para
 * que asuma algo más de carga la semana siguiente, hasta recuperarse. */
export function computeWeeklyTargetShare(occurrences: Occurrence[], tasksById: Map<string, TaskDef>, todayStr: string): WeeklyTargetInfo {
  const zairaStreak = computeBadWeekStreak(occurrences, tasksById, 'zaira', todayStr)
  const jefStreak = computeBadWeekStreak(occurrences, tasksById, 'jef', todayStr)
  const shiftZaira = Math.min(zairaStreak * SHIFT_PER_BAD_WEEK, MAX_SHIFT)
  const shiftJef = Math.min(jefStreak * SHIFT_PER_BAD_WEEK, MAX_SHIFT)
  const net = shiftZaira - shiftJef // positivo => a Zaira le toca MÁS (iba floja)
  const zairaShare = Math.min(0.75, Math.max(0.25, 0.5 + net / 2))
  return {
    share: { zaira: zairaShare, jef: 1 - zairaShare },
    badStreak: { zaira: zairaStreak, jef: jefStreak },
    biased: net !== 0,
  }
}
