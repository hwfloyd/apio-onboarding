import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const redirectTo = `${window.location.origin}/admin`
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
    if (error) {
      setError('No se pudo enviar el link. Verifica el correo e intenta de nuevo.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Backoffice Apio</h1>

        {sent ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-600">
              Te enviamos un link a <span className="font-medium text-gray-900">{email}</span>.
            </p>
            <p className="text-sm text-gray-500">Revisa tu bandeja de entrada y haz click en el link para ingresar.</p>
            <button
              onClick={() => setSent(false)}
              className="text-sm text-blue-600 hover:underline"
            >
              Usar otro correo
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6">Ingresa tu correo y te enviamos un link de acceso</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="henry@apio.cl"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-2 rounded-xl transition-colors"
              >
                {loading ? 'Enviando...' : 'Enviar link de acceso'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
