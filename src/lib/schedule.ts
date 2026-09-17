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

/** Orden de preferencia de días (0=domingo..6=sábado) para colocar tareas
 * semanales/mensuales evitando amontonar en fin de semana. Se rota por tarea
 * para que no todas caigan siempre en el mismo día. */
function weekdayPreference(seed: number): number[] {
  const base = [2, 3, 4, 1, 5, 6, 0] // mar, mié, jue, lun, vie, sáb, dom
  const rot = seed % base.length
  return [...base.slice(rot), ...base.slice(0, rot)]
}

function mondayOf(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 })
}

/** ¿Debe activarse esta tarea mensual en este mes, según su intervalMonths? */
function isMonthlyTaskActiveInMonth(task: TaskDef, monthDate: Date): boolean {
  const interval = task.intervalMonths ?? 1
  if (interval <= 1) return true
  const offset = hashString(task.id) % interval
  const monthsSinceEpoch = differenceInCalendarMonths(monthDate, EPOCH)
  return ((monthsSinceEpoch - offset) % interval + interval) % interval === 0
}

/** Elige `count` fechas dentro de [weekStart, weekStart+6] repartidas y
 * evitando fin de semana cuando es posible. */
function pickDatesInWeek(weekStart: Date, count: number, seed: number): Date[] {
  const pref = weekdayPreference(seed)
  const chosenDow = pref.slice(0, Math.max(count, 1))
  const dates = chosenDow.map((dow) => {
    // distancia desde el lunes de esa semana
    const diff = (dow - 1 + 7) % 7
    return addDays(weekStart, diff)
  })
  return dates.sort((a, b) => a.getTime() - b.getTime()).slice(0, count)
}

/** Elige `count` fechas dentro de un mes, repartidas en semanas distintas y
 * evitando fin de semana cuando es posible. */
function pickDatesInMonth(monthDate: Date, count: number, seed: number): Date[] {
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
    // dentro del bucket, busca el primer día que respete la preferencia de día de semana
    let chosen: Date | undefined
    for (const dow of pref) {
      chosen = bucket.find((d) => getDay(d) === dow && !dates.some((x) => x.getTime() === d.getTime()))
      if (chosen) break
    }
    dates.push(chosen ?? bucket[Math.min(i, bucket.length - 1)])
  }
  return dates.sort((a, b) => a.getTime() - b.getTime())
}

interface GenerateOptions {
  start: Date
  end: Date
  existingKeys: Set<string> // `${taskId}_${date}` ya presentes, no se duplican
  /** minutos acumulados por persona hasta el momento de empezar a generar,
   * para continuar el balance de forma justa en vez de reiniciar cada vez */
  initialLoad?: Record<PersonId, number>
}

export interface DraftOccurrence {
  id: string
  taskId: string
  date: string
  assignedTo: PersonId
  minutes: number
}

/**
 * Genera las ocurrencias que faltan entre `start` y `end` (ambos inclusive)
 * para el catálogo de tareas dado. No decide fin de semana vs entre semana
 * de forma rígida: reparte weekly/monthly evitando el fin de semana cuando
 * hay margen, y balancea minutos entre las dos personas con un criterio
 * voraz (siempre se asigna a quien lleve menos minutos acumulados).
 */
export function generateOccurrences(tasks: TaskDef[], opts: GenerateOptions): DraftOccurrence[] {
  const load: Record<PersonId, number> = {
    zaira: opts.initialLoad?.zaira ?? 0,
    jef: opts.initialLoad?.jef ?? 0,
  }
  let lastPick: PersonId = 'jef' // para alternar en empates, así el primer empate cae en zaira

  function assignPerson(): PersonId {
    let pick: PersonId
    if (load.zaira === load.jef) {
      pick = lastPick === 'zaira' ? 'jef' : 'zaira'
    } else {
      pick = load.zaira < load.jef ? 'zaira' : 'jef'
    }
    lastPick = pick
    return pick
  }

  const draft: DraftOccurrence[] = []
  const active = tasks.filter((t) => t.active)

  function addOccurrence(task: TaskDef, date: Date) {
    const dateStr = format(date, 'yyyy-MM-dd')
    const key = `${task.id}_${dateStr}`
    if (opts.existingKeys.has(key)) return
    const assignedTo = assignPerson()
    load[assignedTo] += task.minutes
    draft.push({ id: key, taskId: task.id, date: dateStr, assignedTo, minutes: task.minutes })
  }

  // --- Diarias: una ocurrencia cada día del rango ---
  const days = eachDayOfInterval({ start: opts.start, end: opts.end })
  for (const day of days) {
    for (const t of active.filter((t) => t.frequency === 'daily')) {
      addOccurrence(t, day)
    }
  }

  // --- Semanales: agrupar por semana (lunes-domingo) dentro del rango ---
  const weekStarts = new Set<string>()
  for (const day of days) weekStarts.add(format(mondayOf(day), 'yyyy-MM-dd'))
  for (const weekStartStr of weekStarts) {
    const weekStart = new Date(weekStartStr + 'T00:00:00')
    for (const t of active.filter((t) => t.frequency === 'weekly')) {
      const seed = hashString(t.id)
      const dates = pickDatesInWeek(weekStart, t.timesPerPeriod, seed)
      for (const d of dates) {
        if (d >= opts.start && d <= opts.end) addOccurrence(t, d)
      }
    }
  }

  // --- Mensuales: agrupar por mes dentro del rango ---
  const monthStarts = new Set<string>()
  for (const day of days) monthStarts.add(format(startOfMonth(day), 'yyyy-MM-dd'))
  for (const monthStartStr of monthStarts) {
    const monthStart = new Date(monthStartStr + 'T00:00:00')
    for (const t of active.filter((t) => t.frequency === 'monthly')) {
      if (!isMonthlyTaskActiveInMonth(t, monthStart)) continue
      const seed = hashString(t.id)
      const dates = pickDatesInMonth(monthStart, t.timesPerPeriod, seed)
      for (const d of dates) {
        if (d >= opts.start && d <= opts.end) addOccurrence(t, d)
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
