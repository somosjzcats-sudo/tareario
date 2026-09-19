import { useMemo, useState } from 'react'
import { ROOMS } from '../data/tasks'
import { useData } from '../context/DataContext'
import { PEOPLE_INFO, useProfile } from '../context/ProfileContext'
import { useAuth } from '../context/AuthContext'
import TaskEditor from './TaskEditor'
import type { TaskDef } from '../lib/types'

const FREQ_META: Record<TaskDef['frequency'], { label: string; icon: string; color: string }> = {
  daily: { label: 'Diaria', icon: '🔁', color: 'var(--color-freq-daily)' },
  weekly: { label: 'Semanal', icon: '📅', color: 'var(--color-freq-weekly)' },
  monthly: { label: 'Mensual', icon: '🗓️', color: 'var(--color-freq-monthly)' },
}
const FREQ_FILTERS = ['all', 'daily', 'weekly', 'monthly'] as const
type FreqFilter = (typeof FREQ_FILTERS)[number]
const ACTIVE_FILTERS = ['all', 'active', 'paused'] as const
type ActiveFilter = (typeof ACTIVE_FILTERS)[number]

const DOW_LABEL = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function fixedDayLabel(t: TaskDef): string | null {
  if (t.fixedDay === undefined || t.fixedDay === null) return null
  if (t.fixedDay === 'weekend') return '📌 finde'
  return `📌 ${DOW_LABEL[t.fixedDay]}`
}

function FreqBadge({ frequency }: { frequency: TaskDef['frequency'] }) {
  const meta = FREQ_META[frequency]
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
      style={{ background: meta.color, color: '#0b1120' }}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  )
}

export default function SettingsView() {
  const { tasks, upsertTask, deleteTask, regenerateFuture, demoMode } = useData()
  const { me, setMe, canSwitch } = useProfile()
  const { requiresLogin, session, signOut } = useAuth()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [filterRoom, setFilterRoom] = useState<string>('all')
  const [filterFreq, setFilterFreq] = useState<FreqFilter>('all')
  const [filterActiveState, setFilterActiveState] = useState<ActiveFilter>('all')
  const [filterText, setFilterText] = useState('')

  const knownRooms = useMemo(() => [...new Set(tasks.map((t) => t.room))], [tasks])

  const filtersActive =
    filterRoom !== 'all' || filterFreq !== 'all' || filterActiveState !== 'all' || filterText.trim() !== ''

  function clearFilters() {
    setFilterRoom('all')
    setFilterFreq('all')
    setFilterActiveState('all')
    setFilterText('')
  }

  const filteredTasks = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    return tasks.filter((t) => {
      if (filterRoom !== 'all' && t.room !== filterRoom) return false
      if (filterFreq !== 'all' && t.frequency !== filterFreq) return false
      if (filterActiveState === 'active' && !t.active) return false
      if (filterActiveState === 'paused' && t.active) return false
      if (q && !t.title.toLowerCase().includes(q) && !(t.detail ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [tasks, filterRoom, filterFreq, filterActiveState, filterText])

  const byRoom = useMemo(() => {
    const map = new Map<string, TaskDef[]>()
    for (const t of filteredTasks) {
      if (!map.has(t.room)) map.set(t.room, [])
      map.get(t.room)!.push(t)
    }
    return map
  }, [filteredTasks])

  async function handleSave(task: TaskDef) {
    setBusy(true)
    setSaveError(null)
    try {
      await upsertTask(task)
      setEditingId(null)
      setCreating(false)
      setSavedMsg(true)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error desconocido al guardar la tarea.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    setBusy(true)
    setSaveError(null)
    try {
      await deleteTask(id)
      setEditingId(null)
      setSavedMsg(true)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error desconocido al borrar la tarea.')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleActive(t: TaskDef) {
    setBusy(true)
    setSaveError(null)
    try {
      await upsertTask({ ...t, active: !t.active })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error desconocido al guardar la tarea.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRegenerate() {
    setBusy(true)
    setSaveError(null)
    try {
      await regenerateFuture()
      setSavedMsg(true)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error desconocido al regenerar el reparto.')
    } finally {
      setBusy(false)
    }
  }

  const totalMinutesDaily = tasks.filter((t) => t.active && t.frequency === 'daily').reduce((s, t) => s + t.minutes, 0)

  return (
    <div className="px-4 md:px-8 pt-4 md:pt-8 pb-24 md:pb-10 max-w-md md:max-w-5xl mx-auto">
      <header className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Ajustes</h1>
          <p className="text-xs text-[color:var(--color-text-dim)]">Catálogo de tareas, minutos y reparto</p>
        </div>
        <button
          onClick={() => {
            setCreating(true)
            setEditingId(null)
            setSaveError(null)
          }}
          className="text-sm font-semibold px-3 py-2 rounded-lg shrink-0"
          style={{ background: 'var(--color-accent)', color: '#0b1120' }}
        >
          + Nueva tarea
        </button>
      </header>

      {demoMode && (
        <div className="rounded-xl border px-3 py-2.5 mb-4 text-xs" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
          Modo demo: los datos se guardan solo en este dispositivo (localStorage) porque Supabase no está configurado todavía. Mira el README para conectar Supabase y compartir el calendario entre los dos móviles/PC.
        </div>
      )}

      <section className="mb-5 md:max-w-sm">
        <h2 className="text-sm font-semibold text-[color:var(--color-text-dim)] uppercase tracking-wide mb-2">Cuenta</h2>
        {canSwitch ? (
          <div className="flex gap-2">
            {(['zaira', 'jef'] as const).map((id) => (
              <button
                key={id}
                onClick={() => setMe(id)}
                className="flex-1 rounded-lg border py-2 text-sm font-medium"
                style={{
                  borderColor: PEOPLE_INFO[id].color,
                  background: me === id ? PEOPLE_INFO[id].color : 'transparent',
                  color: me === id ? '#0b1120' : PEOPLE_INFO[id].color,
                }}
              >
                {PEOPLE_INFO[id].name}
              </button>
            ))}
          </div>
        ) : (
          <div
            className="rounded-lg border px-3 py-2.5 flex items-center justify-between gap-3"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{me ? PEOPLE_INFO[me].name : '—'}</p>
              <p className="text-[11px] text-[color:var(--color-text-dim)] truncate">{session?.user?.email}</p>
            </div>
            {requiresLogin && (
              <button
                onClick={() => void signOut()}
                className="text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-danger)' }}
              >
                Cerrar sesión
              </button>
            )}
          </div>
        )}
      </section>

      <section className="mb-4">
        <p className="text-xs text-[color:var(--color-text-dim)]">
          Carga diaria activa: <strong className="text-[color:var(--color-text)]">{totalMinutesDaily} min/día</strong> combinados en tareas diarias (objetivo ≈ 60 min/día entre los dos, el resto lo reparten las tareas semanales/mensuales).
        </p>
      </section>

      {creating && (
        <div className="mb-5">
          <TaskEditor knownRooms={knownRooms} onCancel={() => setCreating(false)} onSave={handleSave} externalError={saveError} />
        </div>
      )}

      <section className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="🔍 Buscar tarea…"
            className="flex-1 min-w-[140px] rounded-lg px-3 py-1.5 text-sm text-[color:var(--color-text)]"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          />
          <select
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            className="rounded-lg px-2 py-1.5 text-sm text-[color:var(--color-text)]"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <option value="all">Todas las salas</option>
            {knownRooms.map((r) => (
              <option key={r} value={r}>
                {ROOMS[r]?.emoji ?? '🏷️'} {r}
              </option>
            ))}
          </select>
          {filtersActive && (
            <button onClick={clearFilters} className="text-xs underline text-[color:var(--color-text-dim)] shrink-0">
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {FREQ_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilterFreq(f)}
                className="text-[11px] px-2.5 py-1.5 rounded-full font-medium inline-flex items-center gap-1"
                style={{
                  background: filterFreq === f ? (f === 'all' ? 'var(--color-accent)' : FREQ_META[f].color) : 'var(--color-surface-2)',
                  color: filterFreq === f ? '#0b1120' : 'var(--color-text-dim)',
                }}
              >
                {f === 'all' ? 'Todas' : <>{FREQ_META[f].icon} {FREQ_META[f].label}</>}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {ACTIVE_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setFilterActiveState(s)}
                className="text-[11px] px-2.5 py-1.5 rounded-full font-medium"
                style={{
                  background: filterActiveState === s ? 'var(--color-accent)' : 'var(--color-surface-2)',
                  color: filterActiveState === s ? '#0b1120' : 'var(--color-text-dim)',
                }}
              >
                {s === 'all' ? 'Todas' : s === 'active' ? 'Activas' : 'Pausadas'}
              </button>
            ))}
          </div>
          {filtersActive && (
            <span className="text-[11px] text-[color:var(--color-text-dim)]">
              {filteredTasks.length} de {tasks.length} tareas
            </span>
          )}
        </div>
      </section>

      {filteredTasks.length === 0 && (
        <p className="text-sm text-[color:var(--color-text-dim)] text-center py-10">
          No hay tareas que coincidan con los filtros.
        </p>
      )}

      {[...byRoom.entries()].map(([room, roomTasks]) => (
        <section key={room} className="mb-5">
          <h3 className="text-sm font-semibold mb-2">{ROOMS[room]?.emoji ?? '🏷️'} {room}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {roomTasks.map((t) =>
              editingId === t.id ? (
                <div key={t.id} className="md:col-span-2">
                  <TaskEditor
                    task={t}
                    knownRooms={knownRooms}
                    onCancel={() => setEditingId(null)}
                    onSave={handleSave}
                    onDelete={() => handleDelete(t.id)}
                    externalError={saveError}
                  />
                </div>
              ) : (
                <div
                  key={t.id}
                  className="rounded-lg border px-3 py-2 flex flex-col gap-1"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm ${!t.active ? 'line-through text-[color:var(--color-text-dim)]' : ''}`}>{t.title}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleActive(t)}
                        disabled={busy}
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: t.active ? 'var(--color-accent)' : 'var(--color-surface-2)', color: t.active ? '#0b1120' : 'var(--color-text-dim)' }}
                      >
                        {t.active ? 'Activa' : 'Pausada'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(t.id)
                          setCreating(false)
                          setSaveError(null)
                        }}
                        aria-label="Editar tarea"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-xs"
                        style={{ background: 'var(--color-surface-2)' }}
                      >
                        ✏️
                      </button>
                    </div>
                  </div>
                  {t.detail && <p className="text-[11px] text-[color:var(--color-text-dim)]">{t.detail}</p>}
                  <div className="flex items-center gap-2 text-[11px] text-[color:var(--color-text-dim)] flex-wrap">
                    <FreqBadge frequency={t.frequency} />
                    {t.frequency === 'monthly' && (t.intervalMonths ?? 1) > 1 && <span>cada {t.intervalMonths} meses</span>}
                    {t.timesPerPeriod > 1 && <span>×{t.timesPerPeriod}/periodo</span>}
                    <span>{t.minutes} min</span>
                    {fixedDayLabel(t) && <span>{fixedDayLabel(t)}</span>}
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      ))}

      <div
        className="sticky bottom-16 md:static mt-4 pt-2 pb-1 flex flex-col gap-1.5 md:flex-row md:items-center md:justify-end"
        style={{ background: 'linear-gradient(to top, var(--color-bg) 70%, transparent)' }}
      >
        <p className="text-[11px] text-center md:text-right text-[color:var(--color-text-dim)] md:mr-2">
          El reparto futuro se reajusta solo al añadir, editar o borrar tareas.
        </p>
        <button
          onClick={handleRegenerate}
          disabled={busy}
          className="w-full md:w-auto rounded-xl px-4 py-2.5 text-sm font-medium border"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          🔄 Forzar regeneración ahora
        </button>
        {savedMsg && <p className="text-[11px] text-center md:self-center text-[color:var(--color-accent)]">Guardado ✓</p>}
      </div>
    </div>
  )
}
