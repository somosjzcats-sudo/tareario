import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

// Si no hay configuración, exportamos un cliente "vacío" para que la app no
// explote durante el desarrollo antes de configurar Supabase; DataContext
// detecta `supabaseConfigured` y usa un modo local de demostración.
export const supabase = supabaseConfigured
  ? createClient(url as string, anonKey as string)
  : (null as unknown as ReturnType<typeof createClient>)
