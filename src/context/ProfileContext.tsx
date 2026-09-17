import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Person, PersonId } from '../lib/types'

export const PEOPLE_INFO: Record<PersonId, Person> = {
  zaira: { id: 'zaira', name: 'Zaira', color: 'var(--color-zaira)' },
  jef: { id: 'jef', name: 'Jef', color: 'var(--color-jef)' },
}

interface ProfileCtx {
  me: PersonId | null
  setMe: (p: PersonId) => void
  clear: () => void
}

const Ctx = createContext<ProfileCtx | null>(null)

const LS_KEY = 'casa-tareas:me'

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [me, setMeState] = useState<PersonId | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored === 'zaira' || stored === 'jef') setMeState(stored)
  }, [])

  function setMe(p: PersonId) {
    localStorage.setItem(LS_KEY, p)
    setMeState(p)
  }
  function clear() {
    localStorage.removeItem(LS_KEY)
    setMeState(null)
  }

  return <Ctx.Provider value={{ me, setMe, clear }}>{children}</Ctx.Provider>
}

export function useProfile() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useProfile debe usarse dentro de ProfileProvider')
  return ctx
}
