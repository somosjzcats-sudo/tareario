import { useMemo, useState } from 'react'
import { ROOMS } from '../data/tasks'
import { useData } from '../context/DataContext'
import { PEOPLE_INFO, useProfile } from '../context/ProfileContext'
import TaskEditor from './TaskEditor'
import type { TaskDef } from '../lib/types'

const FREQ_LABEL: Record<TaskDef['frequency'], string> = { daily: 'Diaria', weekly: 'Semanal', monthly: 'Mensual' }

export default function SettingsView() {
  const { tasks, upsertTask, deleteTask, regenerateFuture, demoMode } = useData()
  const { me, setMe } = useProfile()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  const byRoom = useMemo(() => {
    const map = new Map<string, TaskDef[]>()
    for (const t of tasks) {
      if (!map.has(t.room)) map.set(t.room, [])
      map.get(t.room)!.push(t)
    }
    return map
  }, [tasks])

  const knownRooms = useMemo(() => [...new Set(tasks.map((t) => t.room))], [tasks])

  async function handleSave(task: TaskDef) {
    setBusy(true)
    await upsertTask(task)
    setBusy(false)
    setEditingId(null)
    setCreating(false)
    setSavedMsg(true)
  }

  async function handleDelete(id: string) {
    setBusy(true)
    await deleteTask(id)
    setBusy(false)
    setEditingId(null)
    setSavedMsg(true)
  }

  async function handleToggleActive(t: TaskDef) {
    setBusy(true)
    await upsertTask({ ...t, active: !t.active })
    setBusy(false)
  }

  async function handleRegenerate() {
    setBusy(true)
    await regenerateFuture()
    setBusy(false)
    setSavedMsg(true)
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
        <h2 className="text-sm font-semibold text-[color:var(--color-text-dim)] uppercase tracking-wide mb-2">Perfil de este dispositivo</h2>
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
      </section>

      <section className="mb-4">
        <p className="text-xs text-[color:var(--color-text-dim)]">
          Carga diaria activa: <strong className="text-[color:var(--color-text)]">{totalMinutesDaily} min/día</strong> combinados en tareas diarias (objetivo ≈ 60 min/día entre los dos, el resto lo reparten las tareas semanales/mensuales).
        </p>
      </section>

      {creating && (
        <div className="mb-5">
          <TaskEditor knownRooms={knownRooms} onCancel={() => setCreating(false)} onSave={handleSave} />
        </div>
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
                  <div className="flex items-center gap-3 text-[11px] text-[color:var(--color-text-dim)] flex-wrap">
                    <span>{FREQ_LABEL[t.frequency]}</span>
                    {t.frequency === 'monthly' && (t.intervalMonths ?? 1) > 1 && <span>cada {t.intervalMonths} meses</span>}
                    {t.timesPerPeriod > 1 && <span>×{t.timesPerPeriod}/periodo</span>}
                    <span>{t.minutes} min</span>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      ))}

      <div
        className="sticky bottom-16 md:static mt-4 pt-2 pb-1 flex flex-col md:flex-row gap-2 md:justify-end"
        style={{ background: 'linear-gradient(to top, var(--color-bg) 70%, transparent)' }}
      >
        <button
          onClick={handleRegenerate}
          disabled={busy}
          className="w-full md:w-auto rounded-xl px-4 py-2.5 text-sm font-medium border"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          🔄 Regenerar reparto futuro (no toca lo ya hecho)
        </button>
        {savedMsg && <p className="text-[11px] text-center md:self-center text-[color:var(--color-accent)]">Guardado ✓</p>}
      </div>
    </div>
  )
}
