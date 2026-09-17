import type { TaskDef, RoomInfo } from '../lib/types'

// Catálogo generado a partir de "lista de tareas.txt".
// Los minutos son estimaciones razonables: ajústalos en Ajustes según la
// experiencia real, la app aprende de eso re-generando el reparto futuro.
//
// Interpretación acordada:
//  - "F2" / "F3" al final de una tarea semanal o mensual = se repite 2 o 3
//    veces dentro de ese periodo (timesPerPeriod).
//  - "/2", "/3", "/6" en tareas mensuales = se hace cada 2, 3 o 6 meses
//    (intervalMonths), no todos los meses.

export const ROOMS: Record<string, RoomInfo> = {
  Cocina: { name: 'Cocina', emoji: '🍳' },
  Salón: { name: 'Salón', emoji: '🛋️' },
  Terraza: { name: 'Terraza', emoji: '🌿' },
  Pasillo: { name: 'Pasillo', emoji: '🚪' },
  'Baño Gatuno': { name: 'Baño Gatuno', emoji: '🐱' },
  Despachos: { name: 'Despachos', emoji: '💻' },
  Baño: { name: 'Baño', emoji: '🚿' },
  Habitación: { name: 'Habitación', emoji: '🛏️' },
  General: { name: 'General', emoji: '🏠' },
}

let n = 0
const id = (p: string) => `${p}-${++n}`

function task(partial: Omit<TaskDef, 'id' | 'active' | 'timesPerPeriod'> & { timesPerPeriod?: number }): TaskDef {
  return {
    id: id(partial.frequency[0] + '-' + partial.room.slice(0, 3).toLowerCase()),
    active: true,
    timesPerPeriod: partial.timesPerPeriod ?? 1,
    ...partial,
  }
}

export const TASKS: TaskDef[] = [
  // ---------- DIARIO ----------
  task({ room: 'Cocina', title: 'Fregadero', detail: 'Desinfectar, vaciar escurridor, sacar lavavajillas', frequency: 'daily', minutes: 8 }),
  task({ room: 'Cocina', title: 'Encimera', detail: 'Despejar (sin tostadora, trapos ni agua) y limpiar', frequency: 'daily', minutes: 4 }),
  task({ room: 'Cocina', title: 'Azulejos y muebles', detail: 'Azulejos frontal fregadero, cubiertas vitro, mueble platos, azulejos cubos basura', frequency: 'daily', minutes: 6 }),
  task({ room: 'Cocina', title: 'Suelo', detail: 'Mopa', frequency: 'daily', minutes: 5 }),

  task({ room: 'Salón', title: 'Mesas', detail: 'Trapo y spray', frequency: 'daily', minutes: 3 }),
  task({ room: 'Salón', title: 'Sofá', detail: 'Ajustar cubiertas y cojines', frequency: 'daily', minutes: 2 }),
  task({ room: 'Salón', title: 'Zona mesita', detail: 'Aspirar y mopa solo zona mesita', frequency: 'daily', minutes: 5 }),

  task({ room: 'Terraza', title: 'Fuentes', detail: 'Vaciar y llenar', frequency: 'daily', minutes: 3 }),

  task({ room: 'Baño Gatuno', title: 'Váter', detail: 'Quitar cacas', frequency: 'daily', minutes: 3 }),
  task({ room: 'Baño Gatuno', title: 'Producto váter', detail: 'Lejía', frequency: 'daily', minutes: 2 }),

  task({ room: 'Baño', title: 'Váter', detail: 'Desinfectar, producto + bayeta', frequency: 'daily', minutes: 4 }),
  task({ room: 'Baño', title: 'Encimera, lavabo y espejo', frequency: 'daily', minutes: 3 }),
  task({ room: 'Baño', title: 'Mampara', frequency: 'daily', minutes: 3 }),
  task({ room: 'Baño', title: 'Fregar', frequency: 'daily', minutes: 3 }),

  task({ room: 'Habitación', title: 'Cama', detail: 'Hacer cama, colocar cojines y peluches', frequency: 'daily', minutes: 3 }),

  // ---------- SEMANAL ----------
  task({ room: 'Cocina', title: 'Campana y poyetes', detail: 'Campana, poyetes, sujeta utensilios + sujeta cuchillos de pared', frequency: 'weekly', minutes: 10 }),
  task({ room: 'Cocina', title: 'Fregar a fondo', detail: 'Fregar suelo (F2: 2 veces por semana)', frequency: 'weekly', minutes: 8, timesPerPeriod: 2 }),

  task({ room: 'Salón', title: 'Polvo y aspirar', detail: 'Quitar el polvo, aspirar superficies y puertas del armario de entrada', frequency: 'weekly', minutes: 12 }),
  task({ room: 'Salón', title: 'Chimenea y detalles', detail: 'Chimenea, mueble blanco, hueco mesita, espejo y cristales del separador', frequency: 'weekly', minutes: 10 }),
  task({ room: 'Salón', title: 'Sillas y suelo', detail: 'Subir sillas, aspirar y fregar', frequency: 'weekly', minutes: 12 }),

  task({ room: 'Terraza', title: 'Railes y suelo', detail: 'Aspirar railes de puertas, aspirar y fregar', frequency: 'weekly', minutes: 12 }),
  task({ room: 'Terraza', title: 'Mobiliario y riego', detail: 'Limpiar/aspirar mesa, mueble, arcón y sillas. Regar', frequency: 'weekly', minutes: 10 }),
  task({ room: 'Terraza', title: 'Comedero y fuentes', detail: 'A fondo (F2: 2 veces por semana)', frequency: 'weekly', minutes: 6, timesPerPeriod: 2 }),

  task({ room: 'General', title: 'Ambientadores', detail: 'Revisar y reponer', frequency: 'weekly', minutes: 3 }),

  task({ room: 'Pasillo', title: 'Aspirar y fregar', frequency: 'weekly', minutes: 6 }),

  task({ room: 'Baño Gatuno', title: 'Limpieza a fondo', detail: 'Váter a fondo, limpiar lavabo, fregar', frequency: 'weekly', minutes: 8 }),

  task({ room: 'Despachos', title: 'Limpieza general', detail: 'Polvo, mesa, cojines, aspirar y fregar', frequency: 'weekly', minutes: 10 }),

  task({ room: 'Baño', title: 'Azulejos váter', frequency: 'weekly', minutes: 6 }),
  task({ room: 'Baño', title: 'Toallas y estante', detail: 'Estante toallitas, revisar basura, cambiar toallas (F2: 2 veces por semana)', frequency: 'weekly', minutes: 5, timesPerPeriod: 2 }),
  task({ room: 'Baño', title: 'Hueco mampara', frequency: 'weekly', minutes: 4 }),
  task({ room: 'Baño', title: 'Ventana', frequency: 'weekly', minutes: 4 }),
  task({ room: 'Baño', title: 'Ducha a fondo', frequency: 'weekly', minutes: 6 }),

  task({ room: 'Habitación', title: 'Cambiar sábanas', frequency: 'weekly', minutes: 8 }),
  task({ room: 'Habitación', title: 'Sacudir alfombra', frequency: 'weekly', minutes: 4 }),
  task({ room: 'Habitación', title: 'Mesitas', frequency: 'weekly', minutes: 3 }),
  task({ room: 'Habitación', title: 'Fregar suelo', frequency: 'weekly', minutes: 6 }),
  task({ room: 'Habitación', title: 'Espejos', frequency: 'weekly', minutes: 3 }),
  task({ room: 'Habitación', title: 'Aspirar superficie', frequency: 'weekly', minutes: 6 }),
  task({ room: 'Habitación', title: 'Lavar protector gatuno', frequency: 'weekly', minutes: 5 }),

  // ---------- MENSUAL ----------
  task({ room: 'General', title: 'Puertas', detail: 'Todas las puertas de la casa', frequency: 'monthly', minutes: 15 }),
  task({ room: 'General', title: 'Estores', frequency: 'monthly', minutes: 15, intervalMonths: 3 }),

  task({ room: 'Cocina', title: 'Estanterías y ventilador', detail: 'Estantería tazas, estantería Ninja, azulejos global, ventilador', frequency: 'monthly', minutes: 20 }),
  task({ room: 'Cocina', title: 'Horno y mosquiteras', frequency: 'monthly', minutes: 25, intervalMonths: 2 }),
  task({ room: 'Cocina', title: 'Ventanas y estante esquinero', frequency: 'monthly', minutes: 15, intervalMonths: 3 }),

  task({ room: 'Salón', title: 'Funda del sofá', detail: 'Cambiar (F2: 2 veces al mes)', frequency: 'monthly', minutes: 10, timesPerPeriod: 2 }),
  task({ room: 'Salón', title: 'Lámpara y paredes', detail: 'Lámpara lila, paredes, ventilador, puerta, felpudo', frequency: 'monthly', minutes: 15 }),
  task({ room: 'Salón', title: 'Lavar cojines', frequency: 'monthly', minutes: 10, intervalMonths: 2 }),
  task({ room: 'Salón', title: 'Cambiar cortinas', frequency: 'monthly', minutes: 8, intervalMonths: 3 }),
  task({ room: 'Salón', title: 'Altillo blanco', frequency: 'monthly', minutes: 15, intervalMonths: 6 }),

  task({ room: 'Terraza', title: 'Fundas sillones', frequency: 'monthly', minutes: 8 }),
  task({ room: 'Terraza', title: 'Encimera plantas', frequency: 'monthly', minutes: 6 }),
  task({ room: 'Terraza', title: 'Ventana', frequency: 'monthly', minutes: 8, intervalMonths: 3 }),

  task({ room: 'Pasillo', title: 'Paredes', frequency: 'monthly', minutes: 8 }),
  task({ room: 'Pasillo', title: 'Puertas', frequency: 'monthly', minutes: 5 }),

  task({ room: 'Baño Gatuno', title: 'Azulejos y cajas', detail: 'Azulejos, cajas de arena a fondo', frequency: 'monthly', minutes: 12 }),

  task({ room: 'Despachos', title: 'Ventilador', frequency: 'monthly', minutes: 5 }),
  task({ room: 'Despachos', title: 'Ventana', frequency: 'monthly', minutes: 5 }),

  task({ room: 'Baño', title: 'Muro y azulejos', detail: 'Muro, azulejos ventana, azulejos resto', frequency: 'monthly', minutes: 15 }),

  task({ room: 'Habitación', title: 'Edredón/funda', detail: 'Cambiar', frequency: 'monthly', minutes: 10 }),
  task({ room: 'Habitación', title: 'Ventilador', frequency: 'monthly', minutes: 5 }),
  task({ room: 'Habitación', title: 'Paredes', frequency: 'monthly', minutes: 8 }),
  task({ room: 'Habitación', title: 'Estanterías pared', frequency: 'monthly', minutes: 6 }),
  task({ room: 'Habitación', title: 'Ventana', frequency: 'monthly', minutes: 5 }),
  task({ room: 'Habitación', title: 'Puertas armario', frequency: 'monthly', minutes: 5 }),
]
