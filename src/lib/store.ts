import { supabase, supabaseConfigured } from './supabase'
import type { Occurrence, TaskDef } from './types'
import { TASKS as SEED_TASKS } from '../data/tasks'

export interface Store {
  getTasks(): Promise<TaskDef[]>
  saveTasks(tasks: TaskDef[]): Promise<void>
  deleteTask(id: string): Promise<void>
  getOccurrences(): Promise<Occurrence[]>
  insertOccurrences(occs: Occurrence[]): Promise<void>
  updateOccurrence(id: string, patch: Partial<Occurrence>): Promise<void>
  deleteOccurrences(ids: string[]): Promise<void>
}

// ---------------- LocalStorage (modo demo / sin Supabase configurado) ----------------

const LS_TASKS = 'tareario:tasks'
const LS_OCC = 'tareario:occurrences'

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeLS<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // almacenamiento no disponible, ignoramos (modo demo)
  }
}

class LocalStore implements Store {
  async getTasks() {
    const existing = readLS<TaskDef[] | null>(LS_TASKS, null)
    if (existing && existing.length) return existing
    writeLS(LS_TASKS, SEED_TASKS)
    return SEED_TASKS
  }
  async saveTasks(tasks: TaskDef[]) {
    writeLS(LS_TASKS, tasks)
  }
  async deleteTask(id: string) {
    const tasks = readLS<TaskDef[]>(LS_TASKS, [])
    writeLS(LS_TASKS, tasks.filter((t) => t.id !== id))
    const occs = readLS<Occurrence[]>(LS_OCC, [])
    writeLS(LS_OCC, occs.filter((o) => o.taskId !== id))
  }
  async getOccurrences() {
    return readLS<Occurrence[]>(LS_OCC, [])
  }
  async insertOccurrences(occs: Occurrence[]) {
    const current = readLS<Occurrence[]>(LS_OCC, [])
    const byId = new Map(current.map((o) => [o.id, o]))
    for (const o of occs) if (!byId.has(o.id)) byId.set(o.id, o)
    writeLS(LS_OCC, [...byId.values()])
  }
  async updateOccurrence(id: string, patch: Partial<Occurrence>) {
    const current = readLS<Occurrence[]>(LS_OCC, [])
    const next = current.map((o) => (o.id === id ? { ...o, ...patch } : o))
    writeLS(LS_OCC, next)
  }
  async deleteOccurrences(ids: string[]) {
    const current = readLS<Occurrence[]>(LS_OCC, [])
    const idSet = new Set(ids)
    writeLS(LS_OCC, current.filter((o) => !idSet.has(o.id)))
  }
}

// ---------------- Supabase ----------------

function fixedDayToDb(fixedDay: TaskDef['fixedDay']): string | null {
  if (fixedDay === undefined || fixedDay === null) return null
  return String(fixedDay)
}
function fixedDayFromDb(value: unknown): TaskDef['fixedDay'] {
  if (value === null || value === undefined || value === '') return undefined
  if (value === 'weekend') return 'weekend'
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function toDbTask(t: TaskDef) {
  return {
    id: t.id,
    room: t.room,
    title: t.title,
    detail: t.detail ?? null,
    frequency: t.frequency,
    interval_months: t.intervalMonths ?? 1,
    times_per_period: t.timesPerPeriod,
    minutes: t.minutes,
    active: t.active,
    fixed_day: fixedDayToDb(t.fixedDay),
  }
}
function fromDbTask(r: Record<string, unknown>): TaskDef {
  return {
    id: r.id as string,
    room: r.room as string,
    title: r.title as string,
    detail: (r.detail as string) ?? undefined,
    frequency: r.frequency as TaskDef['frequency'],
    intervalMonths: (r.interval_months as number) ?? 1,
    timesPerPeriod: r.times_per_period as number,
    minutes: r.minutes as number,
    fixedDay: fixedDayFromDb(r.fixed_day),
    active: r.active as boolean,
  }
}
function toDbOcc(o: Occurrence) {
  return {
    id: o.id,
    task_id: o.taskId,
    date: o.date,
    assigned_to: o.assignedTo,
    status: o.status,
    completed_by: o.completedBy,
    completed_at: o.completedAt,
    points: o.points,
  }
}
function fromDbOcc(r: Record<string, unknown>): Occurrence {
  return {
    id: r.id as string,
    taskId: r.task_id as string,
    date: r.date as string,
    assignedTo: r.assigned_to as Occurrence['assignedTo'],
    status: r.status as Occurrence['status'],
    completedBy: (r.completed_by as Occurrence['completedBy']) ?? null,
    completedAt: (r.completed_at as string) ?? null,
    points: (r.points as number) ?? 0,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  }
}

class SupabaseStore implements Store {
  async getTasks() {
    const { data, error } = await supabase.from('tasks').select('*')
    if (error) throw error
    if (!data || data.length === 0) {
      await this.saveTasks(SEED_TASKS)
      return SEED_TASKS
    }
    return data.map(fromDbTask)
  }
  async saveTasks(tasks: TaskDef[]) {
    const { error } = await supabase.from('tasks').upsert(tasks.map(toDbTask))
    if (error) throw error
  }
  async deleteTask(id: string) {
    // occurrences se borran en cascada por la FK definida en supabase/schema.sql
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
  }
  async getOccurrences() {
    const { data, error } = await supabase.from('occurrences').select('*').order('date', { ascending: true })
    if (error) throw error
    return (data ?? []).map(fromDbOcc)
  }
  async insertOccurrences(occs: Occurrence[]) {
    if (occs.length === 0) return
    const { error } = await supabase.from('occurrences').upsert(occs.map(toDbOcc), { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  }
  async updateOccurrence(id: string, patch: Partial<Occurrence>) {
    const dbPatch: Record<string, unknown> = {}
    if (patch.assignedTo !== undefined) dbPatch.assigned_to = patch.assignedTo
    if (patch.status !== undefined) dbPatch.status = patch.status
    if (patch.completedBy !== undefined) dbPatch.completed_by = patch.completedBy
    if (patch.completedAt !== undefined) dbPatch.completed_at = patch.completedAt
    if (patch.points !== undefined) dbPatch.points = patch.points
    const { error } = await supabase.from('occurrences').update(dbPatch).eq('id', id)
    if (error) throw error
  }
  async deleteOccurrences(ids: string[]) {
    if (ids.length === 0) return
    const { error } = await supabase.from('occurrences').delete().in('id', ids)
    if (error) throw error
  }
}

export const store: Store = supabaseConfigured ? new SupabaseStore() : new LocalStore()
