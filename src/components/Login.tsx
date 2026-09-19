import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email.trim(), password)
    setBusy(false)
    if (error) setError(error === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 safe-top safe-bottom">
      <div className="text-center space-y-2">
        <div className="text-4xl">🏠🔒</div>
        <h1 className="text-2xl font-semibold">Tareario</h1>
        <p className="text-[color:var(--color-text-dim)] text-sm">Entra con tu cuenta para ver el calendario</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <label className="text-xs text-[color:var(--color-text-dim)] flex flex-col gap-1">
          Email
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg px-3 py-2.5 text-sm text-[color:var(--color-text)]"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          />
        </label>
        <label className="text-xs text-[color:var(--color-text-dim)] flex flex-col gap-1">
          Contraseña
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg px-3 py-2.5 text-sm text-[color:var(--color-text)]"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          />
        </label>

        {error && (
          <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--color-surface-2)', color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl py-2.5 text-sm font-semibold"
          style={{ background: 'var(--color-accent)', color: '#0b1120' }}
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="text-xs text-[color:var(--color-text-dim)] text-center max-w-xs">
        ¿No tienes cuenta todavía? La persona que configuró la app puede crearla desde el panel de Supabase (Authentication → Users).
      </p>
    </div>
  )
}
