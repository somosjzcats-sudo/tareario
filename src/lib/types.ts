export type Frequency = 'daily' | 'weekly' | 'monthly'

export type PersonId = 'zaira' | 'jef'

export interface Person {
  id: PersonId
  name: string
  color: string
}

export interface TaskDef {
  id: string
  room: string
  title: string
  detail?: string
  frequency: Frequency
  /** Para tareas mensuales que no son todos los meses: 2 = cada 2 meses, 3 = cada 3, 6 = cada 6 */
  intervalMonths?: number
  /** F2, F3... veces que se repite dentro del periodo (semana o mes) */
  timesPerPeriod: number
  /** minutos estimados por ejecución */
  minutes: number
  active: boolean
  /** Fija esta tarea a un día concreto de la semana (0=domingo..6=sábado,
   * como Date.getDay()), o a "weekend" para que caiga en sábado o domingo
   * (alternando). Solo aplica a tareas semanales o mensuales. */
  fixedDay?: number | 'weekend'
}

export type OccurrenceStatus = 'pending' | 'done' | 'missed'

export interface Occurrence {
  id: string
  taskId: string
  date: string // YYYY-MM-DD
  assignedTo: PersonId
  status: OccurrenceStatus
  completedBy: PersonId | null
  completedAt: string | null
  points: number
  createdAt: string
}

export interface RoomInfo {
  name: string
  emoji: string
}
