import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ESTADO_COLORS = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  en_proceso: 'bg-blue-100 text-blue-800',
  contrato_generado: 'bg-purple-100 text-purple-800',
  firmado: 'bg-green-100 text-green-800',
  completado: 'bg-gray-100 text-gray-800',
}

const ESTADO_LABELS = {
  pendiente: 'Pendiente',
  en_proceso: 'En Proceso',
  contrato_generado: 'Contrato Generado',
  firmado: 'Firmado',
  completado: 'Completado',
}

export default function Backoffice() {
  const [onboardings, setOnboardings] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchOnboardings()
  }, [])

  const fetchOnboardings = async () => {
    const { data, error } = await supabase
      .from('onboardings')
      .select('id, razon_social, rut_sociedad, productos, estado, created_at')
      .order('created_at', { ascending: false })
    if (!error) setOnboardings(data)
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Backoffice Apio — Onboardings</h1>
        <div className="flex items-center gap-4">
          <Link to="/admin/email-template" className="text-sm text-gray-500 hover:text-gray-700">Plantilla correo</Link>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">Cerrar sesión</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : onboardings.length === 0 ? (
          <p className="text-gray-500">No hay onboardings aún.</p>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Razón Social</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">RUT</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Productos</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Estado</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Fecha</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {onboardings.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{o.razon_social}</td>
                    <td className="px-4 py-3 text-gray-600">{o.rut_sociedad}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="flex flex-wrap gap-1">
                        {(o.productos || []).map(p => (
                          <span key={p} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{p.replace('_', ' ')}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${ESTADO_COLORS[o.estado] || 'bg-gray-100 text-gray-600'}`}>
                        {ESTADO_LABELS[o.estado] || o.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(o.created_at).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/onboarding/${o.id}`} className="text-blue-600 hover:text-blue-700 font-medium">
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
