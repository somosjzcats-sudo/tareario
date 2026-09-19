import { addDays, format, subDays } from 'date-fns'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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

interface DataCtx {
  loading: boolean
  error: string | null
  demoMode: boolean
  tasks: TaskDef[]
  tasksById: Map<string, TaskDef>
  occurrences: Occurrence[]
  weeklyTarget: WeeklyTargetInfo
  refresh: () => Promise<void>
  completeOccurrence: (id: string, by: PersonId) => Promise<void>
  uncompleteOccurrence: (id: string) => Promise<void>
  reassignOccurrence: (id: string, to: PersonId) => Promise<void>
  saveTasks: (tasks: TaskDef[]) => Promise<void>
  upsertTask: (task: TaskDef) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  regenerateFuture: () => Promise<void>
}

const Ctx = createContext<DataCtx | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { requiresLogin, session, loading: authLoading } = useAuth()
  const [tasks, setTasks] = useState<TaskDef[]>([])
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  const weeklyTarget = useMemo(
    () => computeWeeklyTargetShare(occurrences, tasksById, todayStr()),
    [occurrences, tasksById],
  )

  const runMaintenance = useCallback(async (currentTasks: TaskDef[], currentOccs: Occurrence[]) => {
    const today = todayStr()
    // 1. Marcar como perdidas las pendientes de días ya pasados
    const toMiss = currentOccs.filter((o) => o.status === 'pending' && o.date < today)
    for (const o of toMiss) {
      await store.updateOccurrence(o.id, { status: 'missed' })
      o.status = 'missed'
    }

    // 2. Generar ocurrencias que falten en la ventana [hoy-3, hoy+42]
    const start = subDays(new Date(), WINDOW_BACK_DAYS)
    const end = addDays(new Date(), WINDOW_FWD_DAYS)
    const existingKeys = new Set(currentOccs.map((o) => o.id))

    // Objetivo de reparto semanal (50/50 salvo penalización por semanas
    // flojas seguidas) para que el balance se juzgue por minutos/semana y no
    // día a día.
    const tasksByIdLocal = new Map(currentTasks.map((t) => [t.id, t]))
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
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [t, o] = await Promise.all([store.getTasks(), store.getOccurrences()])
      const finalOccs = await runMaintenance(t, o)
      setTasks(t)
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
      const stats = computeStats(occurrences, tasksById, occ.assignedTo, todayStr())
      const points = pointsForOccurrence(task?.minutes ?? 5, occ.date, stats.currentStreak)
      const patch = { status: 'done' as const, completedBy: by, completedAt: new Date().toISOString(), points }
      await store.updateOccurrence(id, patch)
      setOccurrences((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
    },
    [occurrences, tasksById],
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

  const value: DataCtx = {
    loading,
    error,
    demoMode: !supabaseConfigured,
    tasks,
    tasksById,
    occurrences,
    weeklyTarget,
    refresh,
    completeOccurrence,
    uncompleteOccurrence,
    reassignOccurrence,
    saveTasks,
    upsertTask,
    deleteTask,
    regenerateFuture,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useData debe usarse dentro de DataProvider')
  return ctx
}

export { todayStr }
