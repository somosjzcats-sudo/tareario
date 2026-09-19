import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import type { Person, PersonId } from '../lib/types'

export const PEOPLE_INFO: Record<PersonId, Person> = {
  zaira: { id: 'zaira', name: 'Zaira', color: 'var(--color-zaira)' },
  jef: { id: 'jef', name: 'Jef', color: 'var(--color-jef)' },
}

interface ProfileCtx {
  me: PersonId | null
  /** false cuando la identidad viene del login real (Supabase Auth) y no se
   * puede cambiar tocando un botón */
  canSwitch: boolean
  setMe: (p: PersonId) => void
  clear: () => void
}

const Ctx = createContext<ProfileCtx | null>(null)

const LS_KEY = 'tareario:me'

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { requiresLogin, authPerson, signOut } = useAuth()
  const [localMe, setLocalMe] = useState<PersonId | null>(null)

  useEffect(() => {
    if (requiresLogin) return
    const stored = localStorage.getItem(LS_KEY)
    if (stored === 'zaira' || stored === 'jef') setLocalMe(stored)
  }, [requiresLogin])

  function setMe(p: PersonId) {
    if (requiresLogin) return // la identidad viene del login, no se puede tocar
    localStorage.setItem(LS_KEY, p)
    setLocalMe(p)
  }
  function clear() {
    if (requiresLogin) {
      void signOut()
      return
    }
    localStorage.removeItem(LS_KEY)
    setLocalMe(null)
  }

  const me = requiresLogin ? authPerson : localMe

  return <Ctx.Provider value={{ me, canSwitch: !requiresLogin, setMe, clear }}>{children}</Ctx.Provider>
}

export function useProfile() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useProfile debe usarse dentro de ProfileProvider')
  return ctx
}
