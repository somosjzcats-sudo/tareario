import { addDays, format, subDays } from 'date-fns'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  buildDateIndex,
  canCompleteNow,
  computeOccurrenceWindow,
  computeRedistribution,
  isDateInVacation,
  neighborDatesFromIndex,
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
}

const Ctx = createContext<DataCtx | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { requiresLogin, session, loading: authLoading } = useAuth()
  const [tasks, setTasks] = useState<TaskDef[]>([])
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [vacations, setVacations] = useState<VacationRange[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  const weeklyTarget = useMemo(
    () => computeWeeklyTargetShare(occurrences, tasksById, todayStr()),
    [occurrences, tasksById],
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
    async (currentTasks: TaskDef[], currentOccs: Occurrence[], currentVacations: VacationRange[]) => {
      const now = new Date()
      const tasksByIdLocal = new Map(currentTasks.map((t) => [t.id, t]))

      // 1. Marcar como perdidas las pendientes cuya ventana de disponibilidad
      //    ya ha caducado (diarias: a las 10:00 del día siguiente; semanales/
      //    mensuales: según su holgura respecto a la ocurrencia vecina).
      //    Las que caen en un periodo de vacaciones nunca caducan.
      const dateIndex = buildDateIndex(currentOccs)
      const toMiss: Occurrence[] = []
      for (const o of currentOccs) {
        if (o.status !== 'pending') continue
        const task = tasksByIdLocal.get(o.taskId)
        if (!task) continue
        if (isDateInVacation(o.date, currentVacations)) continue
        const neighbors = neighborDatesFromIndex(dateIndex, o.taskId, o.date)
        const window = computeOccurrenceWindow(task, o.date, neighbors)
        if (now >= window.expiresAt) toMiss.push(o)
      }
      for (const o of toMiss) {
        await store.updateOccurrence(o.id, { status: 'missed' })
        o.status = 'missed'
      }

      // 2. Generar ocurrencias que falten en la ventana [hoy-3, hoy+42]
      const today = todayStr()
      const start = subDays(new Date(), WINDOW_BACK_DAYS)
      const end = addDays(new Date(), WINDOW_FWD_DAYS)
      const existingKeys = new Set(currentOccs.map((o) => o.id))

      // Objetivo de reparto semanal (50/50 salvo penalización por semanas
      // flojas seguidas) para que el balance se juzgue por minutos/semana y no
      // día a día.
      const { share: targetShare } = computeWeeklyTargetShare(currentOccs, tasksByIdLocal, today)

      const draft = generateOccurrences(currentTasks, { start, end, existingKeys, targetShare })
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
      const [t, o, v] = await Promise.all([store.getTasks(), store.getOccurrences(), store.getVacations()])
      const finalOccs = await runMaintenance(t, o, v)
      setTasks(t)
      setVacations(v)
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

      const stats = computeStats(occurrences, tasksById, occ.assignedTo, todayStr())
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
    [occurrences, tasksById, availabilityById],
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
      // Las que ya se habían dado por perdidas dentro de este rango se
      // devuelven a pendientes: no penalizan durante el viaje.
      const toRevert = occurrences.filter((o) => o.status === 'missed' && isDateInVacation(o.date, next))
      for (const o of toRevert) {
        await store.updateOccurrence(o.id, { status: 'pending' })
      }
      if (toRevert.length > 0) {
        const revertIds = new Set(toRevert.map((o) => o.id))
        setOccurrences((prev) => prev.map((o) => (revertIds.has(o.id) ? { ...o, status: 'pending' as const } : o)))
      }
    },
    [vacations, occurrences],
  )

  const removeVacation = useCallback(
    async (id: string) => {
      const next = vacations.filter((v) => v.id !== id)
      await store.saveVacations(next)
      setVacations(next)
    },
    [vacations],
  )

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
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useData debe usarse dentro de DataProvider')
  return ctx
}

export { todayStr }
