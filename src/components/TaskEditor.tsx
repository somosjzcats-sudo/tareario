import { useState } from 'react'
import { ROOMS } from '../data/tasks'
import { newTaskId } from '../lib/ids'
import type { Frequency, TaskDef } from '../lib/types'

interface Props {
  task?: TaskDef | null
  knownRooms: string[]
  onCancel: () => void
  onSave: (task: TaskDef) => void
  onDelete?: () => void
}

const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Diaria' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
]

export default function TaskEditor({ task, knownRooms, onCancel, onSave, onDelete }: Props) {
  const isNew = !task
  const [room, setRoom] = useState(task?.room ?? '')
  const [title, setTitle] = useState(task?.title ?? '')
  const [detail, setDetail] = useState(task?.detail ?? '')
  const [frequency, setFrequency] = useState<Frequency>(task?.frequency ?? 'weekly')
  const [timesPerPeriod, setTimesPerPeriod] = useState(task?.timesPerPeriod ?? 1)
  const [intervalMonths, setIntervalMonths] = useState(task?.intervalMonths ?? 1)
  const [minutes, setMinutes] = useState(task?.minutes ?? 5)
  const [active, setActive] = useState(task?.active ?? true)
  const [fixedDayOpt, setFixedDayOpt] = useState<string>(
    task?.fixedDay === undefined || task?.fixedDay === null ? 'none' : String(task.fixedDay),
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function handleSave() {
    if (!room.trim() || !title.trim()) {
      setErr('La sala y el título son obligatorios.')
      return
    }
    const fixedDay: TaskDef['fixedDay'] =
      fixedDayOpt === 'none' ? undefined : fixedDayOpt === 'weekend' ? 'weekend' : Number(fixedDayOpt)
    const next: TaskDef = {
      id: task?.id ?? newTaskId(room, title),
      room: room.trim(),
      title: title.trim(),
      detail: detail.trim() || undefined,
      frequency,
      intervalMonths: frequency === 'monthly' ? Math.max(1, intervalMonths) : 1,
      timesPerPeriod: frequency === 'daily' || fixedDay !== undefined ? 1 : Math.max(1, timesPerPeriod),
      minutes: Math.max(1, minutes),
      active,
      fixedDay,
    }
    onSave(next)
  }

  return (
    <div
      className="rounded-xl border p-3 space-y-2.5"
      style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-accent)' }}
    >
      <p className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
        {isNew ? 'Nueva tarea' : 'Editar tarea'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <label className="text-xs text-[color:var(--color-text-dim)] flex flex-col gap-1">
          Sala
          <input
            list="rooms-list"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="rounded px-2 py-1.5 text-sm text-[color:var(--color-text)]"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            placeholder="p.ej. Cocina"
          />
          <datalist id="rooms-list">
            {[...new Set([...Object.keys(ROOMS), ...knownRooms])].map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>

        <label className="text-xs text-[color:var(--color-text-dim)] flex flex-col gap-1">
          Título
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded px-2 py-1.5 text-sm text-[color:var(--color-text)]"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            placeholder="p.ej. Fregadero"
          />
        </label>
      </div>

      <label className="text-xs text-[color:var(--color-text-dim)] flex flex-col gap-1">
        Detalle (opcional)
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          className="rounded px-2 py-1.5 text-sm text-[color:var(--color-text)]"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          placeholder="p.ej. Desinfectar, vaciar escurridor…"
        />
      </label>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <label className="text-xs text-[color:var(--color-text-dim)] flex flex-col gap-1">
          Frecuencia
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            className="rounded px-2 py-1.5 text-sm text-[color:var(--color-text)]"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            {FREQ_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </label>

        {frequency !== 'daily' && fixedDayOpt === 'none' && (
          <label className="text-xs text-[color:var(--color-text-dim)] flex flex-col gap-1">
            Veces / periodo
            <input
              type="number"
              min={1}
              max={7}
              value={timesPerPeriod}
              onChange={(e) => setTimesPerPeriod(Number(e.target.value) || 1)}
              className="rounded px-2 py-1.5 text-sm text-[color:var(--color-text)]"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            />
          </label>
        )}

        {frequency !== 'daily' && (
          <label className="text-xs text-[color:var(--color-text-dim)] flex flex-col gap-1">
            Día fijo
            <select
              value={fixedDayOpt}
              onChange={(e) => setFixedDayOpt(e.target.value)}
              className="rounded px-2 py-1.5 text-sm text-[color:var(--color-text)]"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <option value="none">Sin día fijo</option>
              <option value="weekend">Fin de semana</option>
              <option value="1">Lunes</option>
              <option value="2">Martes</option>
              <option value="3">Miércoles</option>
              <option value="4">Jueves</option>
              <option value="5">Viernes</option>
              <option value="6">Sábado</option>
              <option value="0">Domingo</option>
            </select>
          </label>
        )}

        {frequency === 'monthly' && (
          <label className="text-xs text-[color:var(--color-text-dim)] flex flex-col gap-1">
            Cada N meses
            <input
              type="number"
              min={1}
              max={12}
              value={intervalMonths}
              onChange={(e) => setIntervalMonths(Number(e.target.value) || 1)}
              className="rounded px-2 py-1.5 text-sm text-[color:var(--color-text)]"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            />
          </label>
        )}

        <label className="text-xs text-[color:var(--color-text-dim)] flex flex-col gap-1">
          Minutos
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value) || 1)}
            className="rounded px-2 py-1.5 text-sm text-[color:var(--color-text)]"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          />
        </label>

        <label className="text-xs text-[color:var(--color-text-dim)] flex flex-col gap-1 justify-end">
          <span className="flex items-center gap-1.5 py-1.5">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Activa
          </span>
        </label>
      </div>

      {fixedDayOpt !== 'none' && (
        <p className="text-[11px] text-[color:var(--color-text-dim)]">
          {fixedDayOpt === 'weekend'
            ? 'Caerá en sábado o domingo (alterna entre semanas).'
            : 'Se fija a ese día cada semana/mes; "veces por periodo" queda en 1.'}
        </p>
      )}

      {err && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{err}</p>}

      <div className="flex items-center justify-between pt-1">
        <div>
          {onDelete && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} className="text-xs" style={{ color: 'var(--color-danger)' }}>
              🗑️ Eliminar tarea
            </button>
          )}
          {onDelete && confirmDelete && (
            <div className="flex items-center gap-2 text-xs">
              <span style={{ color: 'var(--color-danger)' }}>¿Seguro? Se borra también su historial.</span>
              <button onClick={onDelete} className="font-semibold" style={{ color: 'var(--color-danger)' }}>Sí, borrar</button>
              <button onClick={() => setConfirmDelete(false)} className="text-[color:var(--color-text-dim)]">Cancelar</button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-surface)' }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--color-accent)', color: '#0b1120' }}
          >
            {isNew ? 'Crear tarea' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
