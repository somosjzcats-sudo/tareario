import {
  addDays,
  differenceInCalendarMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSaturday,
  isSunday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { Occurrence, PersonId, TaskDef } from './types'
import { hashString } from './hash'

const EPOCH = new Date(2020, 0, 1)
const PEOPLE: PersonId[] = ['zaira', 'jef']
const WEEKEND_DAYS = [6, 0] // sábado, domingo (getDay())

/** Orden de preferencia de días (0=domingo..6=sábado) para colocar tareas
 * semanales/mensuales evitando amontonar en fin de semana. Se rota por tarea
 * para que no todas caigan siempre en el mismo día. */
function weekdayPreference(seed: number): number[] {
  const base = [2, 3, 4, 1, 5, 6, 0] // mar, mié, jue, lun, vie, sáb, dom
  const rot = seed % base.length
  return [...base.slice(rot), ...base.slice(0, rot)]
}

export function mondayOf(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function weekKeyOf(dateStr: string): string {
  return format(mondayOf(new Date(dateStr + 'T00:00:00')), 'yyyy-MM-dd')
}

/** ¿Debe activarse esta tarea mensual en este mes, según su intervalMonths? */
function isMonthlyTaskActiveInMonth(task: TaskDef, monthDate: Date): boolean {
  const interval = task.intervalMonths ?? 1
  if (interval <= 1) return true
  const offset = hashString(task.id) % interval
  const monthsSinceEpoch = differenceInCalendarMonths(monthDate, EPOCH)
  return ((monthsSinceEpoch - offset) % interval + interval) % interval === 0
}

function fixedDowFor(task: TaskDef, seed: number): number | null {
  if (task.fixedDay === undefined || task.fixedDay === null) return null
  if (task.fixedDay === 'weekend') return WEEKEND_DAYS[seed % WEEKEND_DAYS.length]
  return task.fixedDay
}

/** Elige `count` fechas dentro de [weekStart, weekStart+6]. Si la tarea tiene
 * día fijo, todas las ocurrencias caen ese día (o se alterna sábado/domingo
 * si el día fijo es "fin de semana"). Si no, reparte evitando fin de semana
 * cuando es posible. */
function pickDatesInWeek(weekStart: Date, count: number, seed: number, task: TaskDef): Date[] {
  const fixedDow = fixedDowFor(task, seed + hashString(weekKeyOfDate(weekStart)))
  if (fixedDow !== null) {
    const diff = (fixedDow - 1 + 7) % 7
    return [addDays(weekStart, diff)]
  }
  const pref = weekdayPreference(seed)
  const chosenDow = pref.slice(0, Math.max(count, 1))
  const dates = chosenDow.map((dow) => {
    const diff = (dow - 1 + 7) % 7
    return addDays(weekStart, diff)
  })
  return dates.sort((a, b) => a.getTime() - b.getTime()).slice(0, count)
}

function weekKeyOfDate(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

/** Elige `count` fechas dentro de un mes, repartidas en semanas distintas. Si
 * la tarea tiene día fijo, busca ese día de la semana dentro de cada bloque. */
function pickDatesInMonth(monthDate: Date, count: number, seed: number, task: TaskDef): Date[] {
  const first = startOfMonth(monthDate)
  const last = endOfMonth(monthDate)
  const days = eachDayOfInterval({ start: first, end: last })
  const weeks = new Map<string, Date[]>()
  for (const d of days) {
    const key = format(mondayOf(d), 'yyyy-MM-dd')
    if (!weeks.has(key)) weeks.set(key, [])
    weeks.get(key)!.push(d)
  }
  const weekBuckets = [...weeks.values()]
  const pref = weekdayPreference(seed)
  const dates: Date[] = []
  for (let i = 0; i < count; i++) {
    const bucket = weekBuckets[Math.floor((i * weekBuckets.length) / count)]
    const fixedDow = fixedDowFor(task, seed + i)
    let chosen: Date | undefined
    if (fixedDow !== null) {
      chosen = bucket.find((d) => getDay(d) === fixedDow)
    }
    if (!chosen) {
      for (const dow of pref) {
        chosen = bucket.find((d) => getDay(d) === dow && !dates.some((x) => x.getTime() === d.getTime()))
        if (chosen) break
      }
    }
    dates.push(chosen ?? bucket[Math.min(i, bucket.length - 1)])
  }
  return dates.sort((a, b) => a.getTime() - b.getTime())
}

interface Placement {
  taskId: string
  date: string
  minutes: number
  room: string
}

interface BuildOptions {
  start: Date
  end: Date
  existingKeys: Set<string> // `${taskId}_${date}` ya presentes, no se duplican
}

/** Primera fase: decide en qué FECHA cae cada ocurrencia (sin decidir
 * todavía quién la hace). Respeta día fijo, evita fin de semana cuando hay
 * margen, y reparte semanales/mensuales dentro de su periodo. */
function buildPlacements(tasks: TaskDef[], opts: BuildOptions): Placement[] {
  const placements: Placement[] = []
  const active = tasks.filter((t) => t.active)
  const seen = new Set<string>()

  function addPlacement(task: TaskDef, date: Date) {
    const dateStr = format(date, 'yyyy-MM-dd')
    if (date < opts.start || date > opts.end) return
    const key = `${task.id}_${dateStr}`
    if (opts.existingKeys.has(key) || seen.has(key)) return
    seen.add(key)
    placements.push({ taskId: task.id, date: dateStr, minutes: task.minutes, room: task.room })
  }

  const days = eachDayOfInterval({ start: opts.start, end: opts.end })

  for (const day of days) {
    for (const t of active.filter((t) => t.frequency === 'daily')) addPlacement(t, day)
  }

  const weekStarts = new Set<string>()
  for (const day of days) weekStarts.add(format(mondayOf(day), 'yyyy-MM-dd'))
  for (const weekStartStr of weekStarts) {
    const weekStart = new Date(weekStartStr + 'T00:00:00')
    for (const t of active.filter((t) => t.frequency === 'weekly')) {
      const seed = hashString(t.id)
      const dates = pickDatesInWeek(weekStart, t.timesPerPeriod, seed, t)
      for (const d of dates) addPlacement(t, d)
    }
  }

  const monthStarts = new Set<string>()
  for (const day of days) monthStarts.add(format(startOfMonth(day), 'yyyy-MM-dd'))
  for (const monthStartStr of monthStarts) {
    const monthStart = new Date(monthStartStr + 'T00:00:00')
    for (const t of active.filter((t) => t.frequency === 'monthly')) {
      if (!isMonthlyTaskActiveInMonth(t, monthStart)) continue
      const seed = hashString(t.id)
      const dates = pickDatesInMonth(monthStart, t.timesPerPeriod, seed, t)
      for (const d of dates) addPlacement(t, d)
    }
  }

  return placements
}

export interface DraftOccurrence {
  id: string
  taskId: string
  date: string
  assignedTo: PersonId
  minutes: number
}

export interface GenerateOptions extends BuildOptions {
  /** Reparto objetivo de minutos semanales entre las dos personas (suman 1).
   * Por defecto 50/50; se desvía cuando alguien lleva semanas flojas, para
   * compensar con algo más de carga hasta que se recupere. */
  targetShare?: Record<PersonId, number>
}

/**
 * Genera las ocurrencias que faltan entre `start` y `end` (ambos inclusive)
 * para el catálogo de tareas dado.
 *
 * Reglas clave:
 * - Todas las tareas del MISMO día y la MISMA habitación se asignan siempre
 *   a la MISMA persona (no tiene sentido que uno limpie la mesa y otro el
 *   polvo del salón el mismo día) — esto también enlaza automáticamente una
 *   tarea diaria con una semanal/mensual de la misma sala si coinciden ese
 *   día.
 * - El objetivo de equilibrio es el TOTAL DE MINUTOS POR SEMANA de cada
 *   persona (no día a día, que es más difícil de igualar), usando el
 *   `targetShare` dado (50/50 por defecto, o desviado como penalización).
 */
export function generateOccurrences(tasks: TaskDef[], opts: GenerateOptions): DraftOccurrence[] {
  const placements = buildPlacements(tasks, opts)
  const targetShare = opts.targetShare ?? { zaira: 0.5, jef: 0.5 }

  // Agrupar por fecha, y dentro de cada fecha por habitación.
  const byDate = new Map<string, Placement[]>()
  for (const p of placements) {
    if (!byDate.has(p.date)) byDate.set(p.date, [])
    byDate.get(p.date)!.push(p)
  }
  const sortedDates = [...byDate.keys()].sort()

  const weekTotals: Record<PersonId, number> = { zaira: 0, jef: 0 }
  let currentWeekKey: string | null = null
  let lastPick: PersonId = 'jef'

  function pickPerson(): PersonId {
    const scoreZaira = weekTotals.zaira / Math.max(targetShare.zaira, 0.05)
    const scoreJef = weekTotals.jef / Math.max(targetShare.jef, 0.05)
    let pick: PersonId
    if (Math.abs(scoreZaira - scoreJef) < 0.0001) {
      pick = lastPick === 'zaira' ? 'jef' : 'zaira'
    } else {
      pick = scoreZaira < scoreJef ? 'zaira' : 'jef'
    }
    lastPick = pick
    return pick
  }

  const draft: DraftOccurrence[] = []

  for (const dateStr of sortedDates) {
    const wk = weekKeyOf(dateStr)
    if (wk !== currentWeekKey) {
      currentWeekKey = wk
      weekTotals.zaira = 0
      weekTotals.jef = 0
    }

    const byRoom = new Map<string, Placement[]>()
    for (const p of byDate.get(dateStr)!) {
      if (!byRoom.has(p.room)) byRoom.set(p.room, [])
      byRoom.get(p.room)!.push(p)
    }
    // orden determinista: habitaciones con más carga primero
    const roomGroups = [...byRoom.entries()].sort((a, b) => {
      const sumA = a[1].reduce((s, p) => s + p.minutes, 0)
      const sumB = b[1].reduce((s, p) => s + p.minutes, 0)
      return sumB - sumA || a[0].localeCompare(b[0])
    })

    for (const [, groupPlacements] of roomGroups) {
      const assignedTo = pickPerson()
      const groupMinutes = groupPlacements.reduce((s, p) => s + p.minutes, 0)
      weekTotals[assignedTo] += groupMinutes
      for (const p of groupPlacements) {
        draft.push({ id: `${p.taskId}_${p.date}`, taskId: p.taskId, date: p.date, assignedTo, minutes: p.minutes })
      }
    }
  }

  return draft.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00')
  return isSaturday(d) || isSunday(d)
}

export function otherPerson(p: PersonId): PersonId {
  return p === 'zaira' ? 'jef' : 'zaira'
}

export { PEOPLE }
export type { Occurrence }
