import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ESTADO_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En Proceso' },
  { value: 'contrato_generado', label: 'Contrato Generado' },
  { value: 'firmado', label: 'Firmado' },
  { value: 'completado', label: 'Completado' },
]

function Row({ label, value }) {
  if (!value && value !== false) return null
  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 pr-4 text-sm font-medium text-gray-500 w-64">{label}</td>
      <td className="py-2 text-sm text-gray-900">{String(value)}</td>
    </tr>
  )
}

export default function OnboardingDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [estado, setEstado] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingContract, setUploadingContract] = useState(false)
  const [sendingTransbank, setSendingTransbank] = useState(false)
  const [msg, setMsg] = useState(null)
  const [emailDraft, setEmailDraft] = useState(null)
  const [emailTab, setEmailTab] = useState('edit')

  useEffect(() => {
    fetchOnboarding()
  }, [id])

  const fetchOnboarding = async () => {
    const { data, error } = await supabase.from('onboardings').select('*').eq('id', id).single()
    if (!error) {
      setData(data)
      setEstado(data.estado)
    }
    setLoading(false)
  }

  const handleEstadoChange = async (newEstado) => {
    setEstado(newEstado)
    setSaving(true)
    await supabase.from('onboardings').update({ estado: newEstado }).eq('id', id)
    setSaving(false)
  }

  const getFileUrl = async (path) => {
    const { data } = await supabase.storage.from('onboarding-docs').createSignedUrl(path, 60)
    return data?.signedUrl
  }

  const handleContractUpload = async (e, tipo) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingContract(true)
    const path = `${id}/contratos/${tipo}_firmado`
    const { error } = await supabase.storage.from('onboarding-docs').upload(path, file, { upsert: true })
    if (!error) {
      const field = `contrato_${tipo}_firmado`
      await supabase.from('onboardings').update({ [field]: path }).eq('id', id)
      setData(d => ({ ...d, [field]: path }))
      setMsg('Contrato subido correctamente.')
    }
    setUploadingContract(false)
  }

  const buildEmailDraft = (d) => {
    const servicios = (d.medios_pago || [])
      .filter(m => m.includes('webpay'))
      .map(m => m === 'webpay_plus' ? 'Webpay Plus' : 'Webpay OneClick')
      .join(' y ')
    return {
      subject: `Solicitud Afiliación Transbank — ${d.razon_social}`,
      body: `<p>Estimado ejecutivo de Transbank,</p>
<p>Adjunto a este correo encontrará la documentación necesaria para procesar la solicitud de afiliación del siguiente cliente:</p>
<ul>
  <li><strong>Razón Social:</strong> ${d.razon_social}</li>
  <li><strong>RUT:</strong> ${d.rut_sociedad}</li>
  <li><strong>Representante Legal:</strong> ${d.nombre_rl}, RUT ${d.rut_rl}</li>
  <li><strong>Servicios solicitados:</strong> ${servicios}</li>
</ul>
<p>En los adjuntos encontrará la escritura de la sociedad, cédula del representante legal, e-RUT y el o los contratos firmados.</p>
<p>Quedo a disposición ante cualquier consulta.</p>
<p>Saludos,<br/>Equipo Apio</p>`,
    }
  }

  const handleSendTransbank = async () => {
    if (!emailDraft) return
    setSendingTransbank(true)
    setMsg(null)
    const res = await fetch('/.netlify/functions/send-transbank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, subject: emailDraft.subject, html: emailDraft.body }),
    })
    if (res.ok) {
      setMsg('Correo a Transbank enviado correctamente.')
      setEmailDraft(null)
    } else {
      const body = await res.json().catch(() => ({}))
      setMsg(`Error al enviar: ${body.error || res.status}`)
    }
    setSendingTransbank(false)
  }

  const handleGenerateContracts = async () => {
    setMsg(null)
    const res = await fetch('/.netlify/functions/generate-contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setMsg('Contratos generados. Revisa los documentos generados abajo.')
      fetchOnboarding()
    } else {
      const body = await res.json().catch(() => ({}))
      setMsg(`Error al generar contratos: ${body.error || res.status}`)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>
  if (!data) return <div className="min-h-screen flex items-center justify-center text-gray-500">Onboarding no encontrado.</div>

  const needsTransbank = data.medios_pago?.includes('webpay_plus') || data.medios_pago?.includes('webpay_oneclick') || data.productos?.includes('pagos_recurrentes')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link to="/admin" className="text-blue-600 hover:text-blue-700 text-sm">← Volver</Link>
        <h1 className="text-xl font-bold text-gray-900">{data.razon_social}</h1>
        <span className="text-gray-400 text-sm">{data.rut_sociedad}</span>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Estado */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Estado del Onboarding</h2>
          <div className="flex items-center gap-3">
            <select
              value={estado}
              onChange={e => handleEstadoChange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ESTADO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {saving && <span className="text-xs text-gray-400">Guardando...</span>}
          </div>
        </div>

        {/* Datos del cliente */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Datos del Cliente</h2>
          <table className="w-full">
            <tbody>
              <Row label="Razón Social" value={data.razon_social} />
              <Row label="Nombre de Fantasía" value={data.nombre_fantasia} />
              <Row label="RUT Sociedad" value={data.rut_sociedad} />
              <Row label="Dirección" value={`${data.direccion}${data.oficina ? `, ${data.oficina}` : ''}, ${data.comuna}, ${data.region}`} />
              <Row label="Actividad Económica" value={data.actividad_economica} />
              <Row label="Nombre Representante Legal" value={data.nombre_rl} />
              <Row label="RUT Representante Legal" value={data.rut_rl} />
              <Row label="Teléfono RL" value={data.telefono_rl} />
              <Row label="Email RL" value={data.email_rl} />
            </tbody>
          </table>
        </div>

        {/* Productos y medios de pago */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Productos y Configuración</h2>
          <table className="w-full">
            <tbody>
              <Row label="Productos" value={(data.productos || []).join(', ')} />
              <Row label="Medios de Pago" value={(data.medios_pago || []).join(', ')} />
              <Row label="OneClick — Máx. transacciones/día" value={data.oneclick_max_transacciones} />
              <Row label="OneClick — Monto máx. por transacción" value={data.oneclick_monto_max ? `$${Number(data.oneclick_monto_max).toLocaleString('es-CL')}` : null} />
              <Row label="OneClick — Monto acumulado máx./día" value={data.oneclick_monto_acumulado ? `$${Number(data.oneclick_monto_acumulado).toLocaleString('es-CL')}` : null} />
              <Row label="Banco" value={data.banco_label} />
              <Row label="N° Cuenta" value={data.numero_cuenta} />
              <Row label="RUT Titular Cuenta" value={data.rut_titular_es_sociedad ? data.rut_sociedad + ' (misma sociedad)' : data.rut_titular_cuenta} />
              <Row label="Documento Tributario" value={(data.tipo_documento_tributario || []).join(', ')} />
              <Row label="Certificado Digital" value={data.tiene_certificado_digital === true ? 'Sí (propio)' : data.tiene_certificado_digital === false ? `No — opción: ${data.certificado_opcion || '-'}` : null} />
              <Row label="Bancos Conciliación" value={(data.bancos_conciliacion || []).join(', ')} />
            </tbody>
          </table>
        </div>

        {/* Acciones */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800 mb-2">Acciones</h2>

          <button
            onClick={handleGenerateContracts}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Generar Contratos Automáticamente
          </button>

          {/* Subir contratos firmados */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Subir Contratos Firmados (Docusign)</p>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Contrato Prestación de Servicios:</label>
              <input type="file" accept=".pdf,.docx" onChange={e => handleContractUpload(e, 'prestacion')} className="text-xs" />
              {data.contrato_prestacion_firmado && <span className="text-xs text-green-600">Subido</span>}
            </div>
            {needsTransbank && (
              <>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600">Contrato Transbank firmado:</label>
                  <input type="file" accept=".pdf,.docx" onChange={e => handleContractUpload(e, 'transbank')} className="text-xs" />
                  {data.contrato_transbank_firmado && <span className="text-xs text-green-600">Subido</span>}
                </div>
                {uploadingContract && <p className="text-xs text-gray-400">Subiendo...</p>}
              </>
            )}
          </div>

          {msg && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              {msg}
            </div>
          )}
        </div>

        {/* Correo a Transbank */}
        {needsTransbank && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Correo a Transbank</h2>

            {!emailDraft ? (
              <button
                onClick={() => { setEmailDraft(buildEmailDraft(data)); setEmailTab('edit') }}
                disabled={!data.contrato_transbank_firmado}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Preparar correo
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
                  <input
                    type="text"
                    value={emailDraft.subject}
                    onChange={e => setEmailDraft(d => ({ ...d, subject: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => setEmailTab('edit')} className={`text-sm px-3 py-1 rounded-md ${emailTab === 'edit' ? 'bg-gray-200 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>Editar</button>
                    <button onClick={() => setEmailTab('preview')} className={`text-sm px-3 py-1 rounded-md ${emailTab === 'preview' ? 'bg-gray-200 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>Previsualizar</button>
                  </div>

                  {emailTab === 'edit' ? (
                    <textarea
                      value={emailDraft.body}
                      onChange={e => setEmailDraft(d => ({ ...d, body: e.target.value }))}
                      rows={12}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div
                      className="border border-gray-200 rounded-lg p-4 text-sm bg-white min-h-48"
                      dangerouslySetInnerHTML={{ __html: emailDraft.body }}
                    />
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSendTransbank}
                    disabled={sendingTransbank}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    {sendingTransbank ? 'Enviando...' : 'Enviar a Transbank'}
                  </button>
                  <button
                    onClick={() => setEmailDraft(null)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {!data.contrato_transbank_firmado && !emailDraft && (
              <p className="text-xs text-gray-400">Debes subir el contrato Transbank firmado antes de preparar el correo.</p>
            )}
          </div>
        )}

        {/* Contratos generados */}
        {(data.contrato_prestacion_path || data.excel_transbank_plus_path || data.excel_transbank_oneclick_path || data.contrato_transbank_plus_path || data.contrato_transbank_oneclick_path) && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Contratos Generados</h2>
            <div className="space-y-2 text-sm">
              {[
                { path: data.contrato_prestacion_path, label: 'Contrato Prestación de Servicios' },
                { path: data.contrato_transbank_plus_path, label: 'Contrato Transbank — Webpay Plus' },
                { path: data.contrato_transbank_oneclick_path, label: 'Contrato Transbank — Webpay OneClick' },
                { path: data.excel_transbank_plus_path, label: 'Ficha Transbank — Webpay Plus' },
                { path: data.excel_transbank_oneclick_path, label: 'Ficha Transbank — Webpay OneClick' },
              ].map(({ path, label }) => path ? (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-gray-600">{label}:</span>
                  <button
                    onClick={async () => { const url = await getFileUrl(path); if (url) window.open(url, '_blank') }}
                    className="text-blue-600 hover:underline"
                  >
                    Descargar
                  </button>
                </div>
              ) : null)}
            </div>
          </div>
        )}

        {/* Documentos adjuntos */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Documentos Adjuntos</h2>
          <div className="space-y-2 text-sm">
            {[
              { path: data.archivo_escritura, label: 'Escritura de la Sociedad' },
              { path: data.archivo_cedula_rl, label: 'Cédula Representante Legal' },
              { path: data.archivo_erut, label: 'E-RUT' },
              { path: data.archivo_cedula_rl_cert, label: 'Cédula RL (certificado digital)' },
            ].map(({ path, label }) => path ? (
              <div key={label} className="flex items-center gap-2">
                <span className="text-gray-600">{label}:</span>
                <button
                  onClick={async () => { const url = await getFileUrl(path); if (url) window.open(url, '_blank') }}
                  className="text-blue-600 hover:underline"
                >
                  Ver documento
                </button>
              </div>
            ) : null)}
          </div>
        </div>
      </div>
    </div>
  )
}
