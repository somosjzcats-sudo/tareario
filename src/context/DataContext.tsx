import { addDays, format, subDays } from 'date-fns'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  buildDateIndex,
  canCompleteNow,
  computeOccurrenceWindow,
  computeRedistribution,
  isDateInVacation,
  isVacationTolerant,
  neighborDatesFromIndex,
  nextFreeDateAfterVacation,
  type OccurrenceWindow,
  type VacationRange,
} from '../lib/availability'
import { computeStats, computeWeeklyTargetShare, pointsForOccurrence, type WeeklyTargetInfo } from '../lib/gamification'
import { generateOccurrences } from '../lib/schedule'
import { store } from '../lib/store'
import { supabaseConfigured } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Occurrence, PersonId, TaskDef } from '../lib/types'

const WINDOW_BACK_DAYS = 3
const WINDOW_FWD_DAYS = 42

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd')
}

export interface OccurrenceAvailability {
  ok: boolean
  reason?: 'too-early' | 'expired'
  window: OccurrenceWindow
  onVacation: boolean
}

interface DataCtx {
  loading: boolean
  error: string | null
  demoMode: boolean
  tasks: TaskDef[]
  tasksById: Map<string, TaskDef>
  occurrences: Occurrence[]
  vacations: VacationRange[]
  availabilityById: Map<string, OccurrenceAvailability>
  weeklyTarget: WeeklyTargetInfo
  /** Fecha (yyyy-MM-dd) desde la que cuentan las estadísticas/puntos, o null
   * si cuenta todo el historial. Las ocurrencias de antes quedan intactas
   * (se siguen viendo día a día en Semana) pero no entran en Estadísticas. */
  statsStartDate: string | null
  /** occurrences ya filtradas por statsStartDate, listas para pasar a las
   * funciones de gamification.ts */
  statsOccurrences: Occurrence[]
  refresh: () => Promise<void>
  completeOccurrence: (id: string, by: PersonId) => Promise<void>
  uncompleteOccurrence: (id: string) => Promise<void>
  reassignOccurrence: (id: string, to: PersonId) => Promise<void>
  saveTasks: (tasks: TaskDef[]) => Promise<void>
  upsertTask: (task: TaskDef) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  regenerateFuture: () => Promise<void>
  addVacation: (v: VacationRange) => Promise<void>
  removeVacation: (id: string) => Promise<void>
  /** Reinicia los contadores/estadísticas para que solo cuenten desde esta
   * fecha en adelante (por defecto, hoy). No borra ni toca las ocurrencias. */
  resetStatsFrom: (date?: string) => Promise<void>
  /** Vuelve a contar todo el historial (quita el reinicio). */
  clearStatsReset: () => Promise<void>
}

const Ctx = createContext<DataCtx | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { requiresLogin, session, loading: authLoading } = useAuth()
  const [tasks, setTasks] = useState<TaskDef[]>([])
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [vacations, setVacations] = useState<VacationRange[]>([])
  const [statsStartDate, setStatsStartDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  const statsOccurrences = useMemo(
    () => (statsStartDate ? occurrences.filter((o) => o.date >= statsStartDate) : occurrences),
    [occurrences, statsStartDate],
  )

  const weeklyTarget = useMemo(
    () => computeWeeklyTargetShare(statsOccurrences, tasksById, todayStr()),
    [statsOccurrences, tasksById],
  )

  // Disponibilidad (ventana de holgura) de cada ocurrencia, calculada una
  // vez para toda la lista y consumida tanto por completeOccurrence como por
  // la UI (checkboxes bloqueados/etiquetas de "disponible desde…").
  const availabilityById = useMemo(() => {
    const map = new Map<string, OccurrenceAvailability>()
    const dateIndex = buildDateIndex(occurrences)
    const now = new Date()
    for (const o of occurrences) {
      const task = tasksById.get(o.taskId)
      if (!task) continue
      const neighbors = neighborDatesFromIndex(dateIndex, o.taskId, o.date)
      const window = computeOccurrenceWindow(task, o.date, neighbors)
      const check = canCompleteNow(task, o.date, window, vacations, now)
      map.set(o.id, { ok: check.ok, reason: check.reason, window, onVacation: isDateInVacation(o.date, vacations) })
    }
    return map
  }, [occurrences, tasksById, vacations])

  const runMaintenance = useCallback(
    async (
      currentTasks: TaskDef[],
      currentOccs: Occurrence[],
      currentVacations: VacationRange[],
      currentStatsStartDate: string | null,
    ) => {
      const now = new Date()
      const tasksByIdLocal = new Map(currentTasks.map((t) => [t.id, t]))

      // 1. Recolocar las pendientes "no tolerantes" a vacaciones (las
      //    mensuales, sea cual sea su intervalo) que hayan quedado dentro de
      //    un periodo de vacaciones: nunca se dejan ahí paradas sin más,
      //    porque se perderían durante meses. Se corren al primer día libre
      //    después de que acaben. Las diarias y semanales sí se pueden dejar
      //    (como mucho se pierde esa ocurrencia y punto).
      if (currentVacations.length > 0) {
        for (const o of currentOccs) {
          if (o.status !== 'pending') continue
          const task = tasksByIdLocal.get(o.taskId)
          if (!task || isVacationTolerant(task)) continue
          if (!isDateInVacation(o.date, currentVacations)) continue
          const newDate = nextFreeDateAfterVacation(o.date, o.taskId, currentOccs, currentVacations)
          if (newDate !== o.date) {
            await store.updateOccurrence(o.id, { date: newDate })
            o.date = newDate
          }
        }
      }

      // 2. Marcar como perdidas las pendientes cuya ventana de disponibilidad
      //    ya ha caducado (diarias: a las 10:00 del día siguiente; semanales/
      //    mensuales: según su holgura respecto a la ocurrencia vecina).
      //    Las diarias/semanales que caen en un periodo de vacaciones nunca
      //    caducan (las mensuales ya se han recolocado fuera en el paso 1).
      const dateIndex = buildDateIndex(currentOccs)
      const toMiss: Occurrence[] = []
      for (const o of currentOccs) {
        if (o.status !== 'pending') continue
        const task = tasksByIdLocal.get(o.taskId)
        if (!task) continue
        if (isDateInVacation(o.date, currentVacations) && isVacationTolerant(task)) continue
        const neighbors = neighborDatesFromIndex(dateIndex, o.taskId, o.date)
        const window = computeOccurrenceWindow(task, o.date, neighbors)
        if (now >= window.expiresAt) toMiss.push(o)
      }
      for (const o of toMiss) {
        await store.updateOccurrence(o.id, { status: 'missed' })
        o.status = 'missed'
      }

      // 3. Generar ocurrencias que falten en la ventana [hoy-3, hoy+42]
      const today = todayStr()
      const start = subDays(new Date(), WINDOW_BACK_DAYS)
      const end = addDays(new Date(), WINDOW_FWD_DAYS)
      // Importante: la clave "ya cubierta" se construye con taskId+FECHA
      // ACTUAL, no con el `id` guardado. El `id` se pone al crear la
      // ocurrencia (`${taskId}_${date}`) y ya no cambia aunque luego se
      // recoloque su fecha (redistribución o recolocación por vacaciones);
      // si aquí comparásemos por `id`, el generador no reconocería la nueva
      // fecha como cubierta y crearía una ocurrencia duplicada para el mismo
      // día.
      const existingKeys = new Set(currentOccs.map((o) => `${o.taskId}_${o.date}`))

      // Objetivo de reparto semanal (50/50 salvo penalización por semanas
      // flojas seguidas) para que el balance se juzgue por minutos/semana y no
      // día a día. Si hay un reinicio de estadísticas, el historial de antes
      // no debe seguir penalizando/beneficiando el reparto.
      const occsForShare = currentStatsStartDate
        ? currentOccs.filter((o) => o.date >= currentStatsStartDate)
        : currentOccs
      const { share: targetShare } = computeWeeklyTargetShare(occsForShare, tasksByIdLocal, today)

      const draft = generateOccurrences(currentTasks, { start, end, existingKeys, targetShare, vacations: currentVacations })
      if (draft.length === 0) return currentOccs

      const nowIso = new Date().toISOString()
      const newOccs: Occurrence[] = draft.map((d) => ({
        id: d.id,
        taskId: d.taskId,
        date: d.date,
        assignedTo: d.assignedTo,
        status: 'pending',
        completedBy: null,
        completedAt: null,
        points: 0,
        createdAt: nowIso,
      }))
      await store.insertOccurrences(newOccs)
      return [...currentOccs, ...newOccs]
    },
    [],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [t, o, v, statsStart] = await Promise.all([
        store.getTasks(),
        store.getOccurrences(),
        store.getVacations(),
        store.getStatsStartDate(),
      ])
      const finalOccs = await runMaintenance(t, o, v, statsStart)
      setTasks(t)
      setVacations(v)
      setStatsStartDate(statsStart)
      setOccurrences([...finalOccs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido cargando datos')
    } finally {
      setLoading(false)
    }
  }, [runMaintenance])

  useEffect(() => {
    // Con login real, esperamos a saber si hay sesión antes de tocar datos.
    if (requiresLogin && authLoading) return
    if (requiresLogin && !session) {
      setTasks([])
      setOccurrences([])
      setLoading(false)
      return
    }
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiresLogin, authLoading, session])

  const completeOccurrence = useCallback(
    async (id: string, by: PersonId) => {
      const occ = occurrences.find((o) => o.id === id)
      if (!occ) return
      const task = tasksById.get(occ.taskId)
      if (!task) return

      if (occ.status === 'missed') {
        throw new Error(
          task.frequency === 'daily'
            ? 'Esta tarea diaria ya caducó: las diarias se pierden si no se marcan antes de las 10:00 del día siguiente.'
            : 'Esta tarea ya caducó y se dio por perdida.',
        )
      }
      const avail = availabilityById.get(id)
      if (avail && !avail.ok) {
        if (task.frequency === 'daily') {
          throw new Error('Esta tarea diaria ya caducó: las diarias se pierden si no se marcan antes de las 10:00 del día siguiente.')
        }
        if (avail.reason === 'too-early') {
          throw new Error(`Todavía no toca: esta tarea se puede marcar a partir del ${avail.window.earliestDate}.`)
        }
        throw new Error(`Esta tarea ya caducó: el plazo terminaba el ${avail.window.latestDate}.`)
      }

      const stats = computeStats(statsOccurrences, tasksById, occ.assignedTo, todayStr())
      const points = pointsForOccurrence(task.minutes, occ.date, stats.currentStreak)
      const patch = { status: 'done' as const, completedBy: by, completedAt: new Date().toISOString(), points }
      await store.updateOccurrence(id, patch)
      setOccurrences((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))

      // Si se ha completado tarde (fuera de su día original), intentamos
      // correr un poco la siguiente ocurrencia de la misma tarea, para que el
      // ritmo real no se comprima y siga sin poder solaparse con la de
      // después. Es un ajuste de un solo paso, no en cadena.
      const today = todayStr()
      if (today > occ.date && task.frequency !== 'daily') {
        const future = occurrences
          .filter((o) => o.taskId === occ.taskId && o.date > occ.date && o.status === 'pending')
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .map((o) => ({ id: o.id, date: o.date }))
        const redis = computeRedistribution(task, occ.date, today, future)
        if (redis) {
          await store.updateOccurrence(redis.id, { date: redis.date })
          setOccurrences((prev) => prev.map((o) => (o.id === redis.id ? { ...o, date: redis.date } : o)))
        }
      }
    },
    [occurrences, statsOccurrences, tasksById, availabilityById],
  )

  const uncompleteOccurrence = useCallback(async (id: string) => {
    const patch = { status: 'pending' as const, completedBy: null, completedAt: null, points: 0 }
    await store.updateOccurrence(id, patch)
    setOccurrences((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  }, [])

  const reassignOccurrence = useCallback(async (id: string, to: PersonId) => {
    await store.updateOccurrence(id, { assignedTo: to })
    setOccurrences((prev) => prev.map((o) => (o.id === id ? { ...o, assignedTo: to } : o)))
  }, [])

  const saveTasks = useCallback(async (next: TaskDef[]) => {
    await store.saveTasks(next)
    setTasks(next)
  }, [])

  const regenerateFuture = useCallback(async () => {
    const today = todayStr()
    const toDelete = occurrences.filter((o) => o.status === 'pending' && o.date >= today).map((o) => o.id)
    if (toDelete.length > 0) await store.deleteOccurrences(toDelete)
    await refresh()
  }, [occurrences, refresh])

  const upsertTask = useCallback(
    async (task: TaskDef) => {
      const exists = tasks.some((t) => t.id === task.id)
      const next = exists ? tasks.map((t) => (t.id === task.id ? task : t)) : [...tasks, task]
      await store.saveTasks(next)
      setTasks(next)
      // Reajuste automático: al añadir/editar una tarea, el reparto futuro
      // se recalcula solo (ya no hace falta pulsar un botón).
      await regenerateFuture()
    },
    [tasks, regenerateFuture],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      await store.deleteTask(id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
      setOccurrences((prev) => prev.filter((o) => o.taskId !== id))
      await regenerateFuture()
    },
    [regenerateFuture],
  )

  const addVacation = useCallback(
    async (v: VacationRange) => {
      const next = [...vacations, v].sort((a, b) => (a.start < b.start ? -1 : 1))
      await store.saveVacations(next)
      setVacations(next)

      // Las diarias/semanales que ya se habían dado por perdidas dentro de
      // este rango se devuelven a pendientes: no penalizan durante el viaje.
      // Las mensuales no se "resucitan" así sin más (si ya se perdieron es
      // que se perdieron); en su lugar, si siguen pendientes, se recolocan.
      const toRevert = occurrences.filter((o) => {
        if (o.status !== 'missed' || !isDateInVacation(o.date, next)) return false
        const task = tasksById.get(o.taskId)
        return task ? isVacationTolerant(task) : false
      })
      for (const o of toRevert) {
        await store.updateOccurrence(o.id, { status: 'pending' })
      }

      // Las mensuales (nunca tolerantes) que sigan pendientes y hayan
      // quedado dentro de este nuevo rango se recolocan ya mismo, al primer
      // día libre después de que acaben las vacaciones, para no perder esa
      // ocurrencia durante meses.
      const toReschedule = occurrences.filter((o) => {
        if (o.status !== 'pending' || !isDateInVacation(o.date, next)) return false
        const task = tasksById.get(o.taskId)
        return task ? !isVacationTolerant(task) : false
      })
      const rescheduled = new Map<string, string>()
      let working = occurrences
      for (const o of toReschedule) {
        const newDate = nextFreeDateAfterVacation(o.date, o.taskId, working, next)
        if (newDate !== o.date) {
          await store.updateOccurrence(o.id, { date: newDate })
          rescheduled.set(o.id, newDate)
          working = working.map((x) => (x.id === o.id ? { ...x, date: newDate } : x))
        }
      }

      if (toRevert.length > 0 || rescheduled.size > 0) {
        const revertIds = new Set(toRevert.map((o) => o.id))
        setOccurrences((prev) =>
          prev.map((o) => {
            if (revertIds.has(o.id)) return { ...o, status: 'pending' as const }
            const newDate = rescheduled.get(o.id)
            return newDate ? { ...o, date: newDate } : o
          }),
        )
      }
    },
    [vacations, occurrences, tasksById],
  )

  const removeVacation = useCallback(
    async (id: string) => {
      const next = vacations.filter((v) => v.id !== id)
      await store.saveVacations(next)
      setVacations(next)
    },
    [vacations],
  )

  const resetStatsFrom = useCallback(async (date?: string) => {
    const from = date ?? todayStr()
    await store.saveStatsStartDate(from)
    setStatsStartDate(from)
  }, [])

  const clearStatsReset = useCallback(async () => {
    await store.saveStatsStartDate(null)
    setStatsStartDate(null)
  }, [])

  const value: DataCtx = {
    loading,
    error,
    demoMode: !supabaseConfigured,
    tasks,
    tasksById,
    occurrences,
    vacations,
    availabilityById,
    weeklyTarget,
    statsStartDate,
    statsOccurrences,
    refresh,
    completeOccurrence,
    uncompleteOccurrence,
    reassignOccurrence,
    saveTasks,
    upsertTask,
    deleteTask,
    regenerateFuture,
    addVacation,
    removeVacation,
    resetStatsFrom,
    clearStatsReset,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useData debe usarse dentro de DataProvider')
  return ctx
}

export { todayStr }
