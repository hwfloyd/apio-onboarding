import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DEFAULT_SUBJECT = 'Solicitud Afiliación Transbank — {razon_social}'
const DEFAULT_BODY = `<p>Estimado ejecutivo de Transbank,</p>
<p>Adjunto a este correo encontrará la documentación necesaria para procesar la solicitud de afiliación del siguiente cliente:</p>
<ul>
  <li><strong>Razón Social:</strong> {razon_social}</li>
  <li><strong>RUT:</strong> {rut_sociedad}</li>
  <li><strong>Representante Legal:</strong> {nombre_rl}, RUT {rut_rl}</li>
  <li><strong>Servicios solicitados:</strong> {servicios}</li>
</ul>
<p>En los adjuntos encontrará la escritura de la sociedad, cédula del representante legal, e-RUT y el o los contratos firmados.</p>
<p>Quedo a disposición ante cualquier consulta.</p>
<p>Saludos,<br/>Equipo Apio</p>`

export default function EmailTemplate() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [tab, setTab] = useState('edit')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    loadTemplate()
  }, [])

  const loadTemplate = async () => {
    const { data, error } = await supabase.storage
      .from('onboarding-docs')
      .download('templates/email_transbank.json')

    if (!error && data) {
      const json = JSON.parse(await data.text())
      setSubject(json.subject || DEFAULT_SUBJECT)
      setBody(json.body || DEFAULT_BODY)
    } else {
      setSubject(DEFAULT_SUBJECT)
      setBody(DEFAULT_BODY)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setMsg(null)
    const blob = new Blob([JSON.stringify({ subject, body })], { type: 'application/json' })
    const { error } = await supabase.storage
      .from('onboarding-docs')
      .upload('templates/email_transbank.json', blob, { upsert: true, contentType: 'application/json' })
    setMsg(error ? `Error al guardar: ${error.message}` : 'Plantilla guardada correctamente.')
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link to="/admin" className="text-blue-600 hover:text-blue-700 text-sm">← Volver</Link>
        <h1 className="text-xl font-bold text-gray-900">Plantilla correo Transbank</h1>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Usa <code className="bg-gray-100 px-1 rounded">{'{variable}'}</code> para insertar datos del cliente.
            Variables disponibles: <code className="bg-gray-100 px-1 rounded">{'{razon_social}'}</code> <code className="bg-gray-100 px-1 rounded">{'{rut_sociedad}'}</code> <code className="bg-gray-100 px-1 rounded">{'{nombre_rl}'}</code> <code className="bg-gray-100 px-1 rounded">{'{rut_rl}'}</code> <code className="bg-gray-100 px-1 rounded">{'{servicios}'}</code>
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setTab('edit')} className={`text-sm px-3 py-1 rounded-md ${tab === 'edit' ? 'bg-gray-200 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>Editar</button>
              <button onClick={() => setTab('preview')} className={`text-sm px-3 py-1 rounded-md ${tab === 'preview' ? 'bg-gray-200 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>Previsualizar</button>
            </div>
            {tab === 'edit' ? (
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={16}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <div
                className="border border-gray-200 rounded-lg p-4 text-sm bg-white min-h-48"
                dangerouslySetInnerHTML={{ __html: body }}
              />
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar plantilla'}
            </button>
            {msg && <p className="text-sm text-green-600">{msg}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
