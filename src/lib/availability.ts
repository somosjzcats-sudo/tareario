import { addDays, format } from 'date-fns'
import type { Occurrence, TaskDef } from './types'

/** Las diarias caducan a las 10:00 del día siguiente (margen para marcar algo
 * que se te olvidó revisar antes de medianoche), y nunca se pueden hacer ni
 * antes ni después de su día. */
export const DAILY_GRACE_HOURS = 10

/** Holgura máxima (antes y después de la fecha prevista) para tareas
 * semanales y mensuales, en días. El hueco real se recorta además para que
 * nunca llegue a solapar con la ocurrencia anterior/siguiente de la misma
 * tarea (ver computeFlex). */
export const WEEKLY_MAX_FLEX_DAYS = 2
export const MONTHLY_MAX_FLEX_DAYS = 5

function toDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}
function dayStr(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}
export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000)
}

/** Busca, dentro de una lista de ocurrencias, la fecha de la ocurrencia
 * anterior y la siguiente de la misma tarea respecto a `date` (excluyendo la
 * propia). No filtra por estado: para calcular la holgura nos interesan
 * todas las fechas ya planificadas para esa tarea, hechas o no. */
export function findNeighborDates(
  occurrences: Occurrence[],
  taskId: string,
  date: string,
): { prevDate: string | null; nextDate: string | null } {
  let prevDate: string | null = null
  let nextDate: string | null = null
  for (const o of occurrences) {
    if (o.taskId !== taskId || o.date === date) continue
    if (o.date < date && (prevDate === null || o.date > prevDate)) prevDate = o.date
    if (o.date > date && (nextDate === null || o.date < nextDate)) nextDate = o.date
  }
  return { prevDate, nextDate }
}

/** Construye un mapa taskId -> fechas ordenadas, para resolver muchos
 * findNeighborDates sin recorrer toda la lista cada vez (útil en el barrido
 * de mantenimiento, que revisa todas las pendientes de golpe). */
export function buildDateIndex(occurrences: Occurrence[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const o of occurrences) {
    if (!map.has(o.taskId)) map.set(o.taskId, [])
    map.get(o.taskId)!.push(o.date)
  }
  for (const dates of map.values()) dates.sort()
  return map
}

export function neighborDatesFromIndex(
  index: Map<string, string[]>,
  taskId: string,
  date: string,
): { prevDate: string | null; nextDate: string | null } {
  const dates = index.get(taskId)
  if (!dates || dates.length === 0) return { prevDate: null, nextDate: null }
  let prevDate: string | null = null
  let nextDate: string | null = null
  for (const d of dates) {
    if (d === date) continue
    if (d < date) prevDate = d // dates está ordenado, así que el último que cumpla esto es el más cercano
    if (d > date && nextDate === null) nextDate = d
  }
  return { prevDate, nextDate }
}

function maxFlexFor(task: TaskDef): number {
  return task.frequency === 'monthly' ? MONTHLY_MAX_FLEX_DAYS : WEEKLY_MAX_FLEX_DAYS
}

/** Cuántos días de margen (a cada lado) puede tener una ocurrencia sin
 * llegar a solaparse con la anterior/siguiente de la misma tarea. Con hueco
 * `gap` hasta el vecino, dejamos como mucho floor((gap-1)/2) a cada lado, así
 * los dos márgenes (el de esta y el del vecino) nunca se tocan. */
export function flexTowards(gap: number | null, maxFlex: number): number {
  if (gap === null) return maxFlex
  return Math.max(0, Math.min(maxFlex, Math.floor((gap - 1) / 2)))
}

export interface OccurrenceWindow {
  /** Primer día (yyyy-MM-dd) en que se puede marcar como hecha */
  earliestDate: string
  /** Último día (yyyy-MM-dd) en que se puede marcar como hecha */
  latestDate: string
  /** Instante exacto a partir del cual se considera perdida si sigue pendiente */
  expiresAt: Date
  earlyFlexDays: number
  lateFlexDays: number
}

export function computeOccurrenceWindow(
  task: TaskDef,
  date: string,
  neighbors: { prevDate: string | null; nextDate: string | null },
): OccurrenceWindow {
  if (task.frequency === 'daily') {
    const expiresAt = addDays(toDate(date), 1)
    expiresAt.setHours(DAILY_GRACE_HOURS, 0, 0, 0)
    return { earliestDate: date, latestDate: date, expiresAt, earlyFlexDays: 0, lateFlexDays: 0 }
  }
  const maxFlex = maxFlexFor(task)
  const gapPrev = neighbors.prevDate ? daysBetween(neighbors.prevDate, date) : null
  const gapNext = neighbors.nextDate ? daysBetween(date, neighbors.nextDate) : null
  const earlyFlexDays = flexTowards(gapPrev, maxFlex)
  const lateFlexDays = flexTowards(gapNext, maxFlex)
  const earliestDate = dayStr(addDays(toDate(date), -earlyFlexDays))
  const latestDate = dayStr(addDays(toDate(date), lateFlexDays))
  const expiresAt = addDays(toDate(latestDate), 1) // medianoche del día siguiente al último día válido
  return { earliestDate, latestDate, expiresAt, earlyFlexDays, lateFlexDays }
}

export interface VacationRange {
  id: string
  start: string // yyyy-MM-dd
  end: string // yyyy-MM-dd, inclusive
  label?: string
}

export function isDateInVacation(date: string, vacations: VacationRange[]): boolean {
  return vacations.some((v) => date >= v.start && date <= v.end)
}

/** ¿Se puede marcar esta ocurrencia como hecha ahora mismo? Las de vacaciones
 * siempre se pueden marcar (por si al final sí os da tiempo a hacer algo). */
export function canCompleteNow(
  _task: TaskDef,
  date: string,
  window: OccurrenceWindow,
  vacations: VacationRange[],
  now: Date = new Date(),
): { ok: boolean; reason?: 'too-early' | 'expired' } {
  if (isDateInVacation(date, vacations)) return { ok: true }
  const earliestStart = toDate(window.earliestDate)
  if (now < earliestStart) return { ok: false, reason: 'too-early' }
  if (now >= window.expiresAt) return { ok: false, reason: 'expired' }
  return { ok: true }
}

/** Si una ocurrencia se completa tarde (después de su fecha prevista),
 * calculamos si conviene retrasar también la siguiente ocurrencia pendiente
 * de la misma tarea, para que el ritmo real de la tarea no se comprima (p.ej.
 * si limpiar la terraza tocaba el lunes y se hace el miércoles, que la
 * siguiente no siga fijada al lunes de la semana que viene sino que se corra
 * un poco). Es un ajuste de un solo paso (no encadena varios retrasos) y
 * nunca invade el hueco de la ocurrencia posterior a esa. Las diarias no se
 * redistribuyen: si no se hacen a tiempo, se pierden y punto. */
export function computeRedistribution(
  task: TaskDef,
  completedDate: string,
  actualDate: string,
  futureOccurrences: { id: string; date: string }[],
): { id: string; date: string } | null {
  if (task.frequency === 'daily') return null
  const lateDays = daysBetween(completedDate, actualDate)
  if (lateDays <= 0) return null
  const next = futureOccurrences[0]
  if (!next) return null
  const afterNext = futureOccurrences[1]
  const maxFlex = maxFlexFor(task)
  const gapToAfter = afterNext ? daysBetween(next.date, afterNext.date) : null
  const maxShift = flexTowards(gapToAfter, maxFlex)
  const shift = Math.min(lateDays, maxShift)
  if (shift <= 0) return null
  return { id: next.id, date: dayStr(addDays(toDate(next.date), shift)) }
}
