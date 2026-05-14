import { useState } from 'react'
import Select from 'react-select'
import { supabase } from '../lib/supabase'
import { ACTIVIDADES_ECONOMICAS, BANCOS, REGIONES } from '../lib/actividadesEconomicas'

const PRODUCTOS = [
  { id: 'link_pago', label: 'Link de Pago' },
  { id: 'checkout', label: 'Checkout' },
  { id: 'conciliacion', label: 'Conciliación Bancaria' },
  { id: 'facturacion', label: 'Facturación Automática' },
  { id: 'pagos_recurrentes', label: 'Pagos Recurrentes' },
  { id: 'portal_pagos', label: 'Portal de Pagos' },
]

const MEDIOS_PAGO = [
  { id: 'webpay_plus', label: 'Webpay Plus', tipo: 'unico' },
  { id: 'webpay_oneclick', label: 'Webpay OneClick', tipo: 'automatico' },
  { id: 'transferencias', label: 'Transferencias', tipo: 'unico' },
  { id: 'mercadopago', label: 'MercadoPago', tipo: 'unico' },
]

const PRODUCTOS_CON_MEDIOS_PAGO = ['link_pago', 'checkout', 'portal_pagos']
const PRODUCTOS_CON_DOCUMENTOS = ['link_pago', 'checkout', 'pagos_recurrentes', 'portal_pagos']

const initialForm = {
  // Datos sociedad
  razon_social: '',
  nombre_fantasia: '',
  rut_sociedad: '',
  direccion: '',
  oficina: '',
  comuna: '',
  region: '',
  // Representante legal
  nombre_rl: '',
  rut_rl: '',
  telefono_rl: '',
  email_rl: '',
  actividad_economica: null,
  // Productos
  productos: [],
  // Medios de pago
  medios_pago: [],
  // Parámetros OneClick
  oneclick_max_transacciones: '10',
  oneclick_monto_max: '1000000',
  oneclick_monto_acumulado: '2000000',
  // Datos bancarios
  banco: null,
  rut_titular_cuenta: '',
  rut_titular_es_sociedad: false,
  numero_cuenta: '',
  // Facturación
  tipo_documento_tributario: [],
  tiene_certificado_digital: null,
  certificado_opcion: null,
  // Conciliación
  bancos_conciliacion: [],
  // Archivos
  archivo_escritura: null,
  archivo_cedula_rl: null,
  archivo_erut: null,
  archivo_cedula_rl_cert: null,
}

function Field({ label, required, children, hint }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      {...props}
    />
  )
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
      {children}
    </h2>
  )
}

export default function OnboardingForm() {
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const toggleProducto = (id) => {
    setForm(f => {
      const productos = f.productos.includes(id)
        ? f.productos.filter(p => p !== id)
        : [...f.productos, id]

      // Si se quita pagos_recurrentes, limpiamos medios de pago automáticos forzados
      let medios_pago = f.medios_pago
      if (!productos.includes('pagos_recurrentes') && !PRODUCTOS_CON_MEDIOS_PAGO.some(p => productos.includes(p))) {
        medios_pago = []
      }
      return { ...f, productos, medios_pago }
    })
  }

  const toggleMedioPago = (id) => {
    // En pagos_recurrentes, oneclick es obligatorio
    if (id === 'webpay_oneclick' && form.productos.includes('pagos_recurrentes') && !PRODUCTOS_CON_MEDIOS_PAGO.some(p => form.productos.includes(p))) {
      return
    }
    setForm(f => ({
      ...f,
      medios_pago: f.medios_pago.includes(id)
        ? f.medios_pago.filter(m => m !== id)
        : [...f.medios_pago, id],
    }))
  }

  const toggleDocTributario = (val) => {
    setForm(f => ({
      ...f,
      tipo_documento_tributario: f.tipo_documento_tributario.includes(val)
        ? f.tipo_documento_tributario.filter(v => v !== val)
        : [...f.tipo_documento_tributario, val],
    }))
  }

  const needsMediosPago = PRODUCTOS_CON_MEDIOS_PAGO.some(p => form.productos.includes(p))
  const needsDocumentos = PRODUCTOS_CON_DOCUMENTOS.some(p => form.productos.includes(p))
  const needsOneclick = form.medios_pago.includes('webpay_oneclick') || form.productos.includes('pagos_recurrentes')
  const needsDatosBancarios = form.medios_pago.includes('webpay_plus') || form.medios_pago.includes('webpay_oneclick')
  const needsPagosRecurrentes = form.productos.includes('pagos_recurrentes')
  const needsFacturacion = form.productos.includes('facturacion')
  const needsConciliacion = form.productos.includes('conciliacion')

  const handleFileChange = (field, e) => {
    set(field, e.target.files[0] || null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 1. Subir archivos a Supabase Storage
      const uploadFile = async (file, path) => {
        if (!file) return null
        const { data, error } = await supabase.storage
          .from('onboarding-docs')
          .upload(path, file, { upsert: true })
        if (error) throw error
        return data.path
      }

      const timestamp = Date.now()
      const folder = `${timestamp}_${form.rut_sociedad.replace(/\./g, '').replace('-', '')}`

      const [escritura, cedula_rl, erut, cedula_cert] = await Promise.all([
        uploadFile(form.archivo_escritura, `${folder}/escritura_sociedad`),
        uploadFile(form.archivo_cedula_rl, `${folder}/cedula_rl`),
        uploadFile(form.archivo_erut, `${folder}/erut`),
        uploadFile(form.archivo_cedula_rl_cert, `${folder}/cedula_rl_certificado`),
      ])

      // 2. Guardar en base de datos
      const { data: onboarding, error: dbError } = await supabase
        .from('onboardings')
        .insert({
          razon_social: form.razon_social,
          nombre_fantasia: form.nombre_fantasia,
          rut_sociedad: form.rut_sociedad,
          direccion: form.direccion,
          oficina: form.oficina,
          comuna: form.comuna,
          region: form.region,
          nombre_rl: form.nombre_rl,
          rut_rl: form.rut_rl,
          telefono_rl: form.telefono_rl,
          email_rl: form.email_rl,
          actividad_economica: form.actividad_economica?.label || null,
          productos: form.productos,
          medios_pago: form.medios_pago,
          oneclick_max_transacciones: needsOneclick ? form.oneclick_max_transacciones : null,
          oneclick_monto_max: needsOneclick ? form.oneclick_monto_max : null,
          oneclick_monto_acumulado: needsOneclick ? form.oneclick_monto_acumulado : null,
          banco: needsDatosBancarios ? form.banco?.value : null,
          banco_label: needsDatosBancarios ? form.banco?.label : null,
          rut_titular_cuenta: needsDatosBancarios && !form.rut_titular_es_sociedad ? form.rut_titular_cuenta : null,
          rut_titular_es_sociedad: needsDatosBancarios ? form.rut_titular_es_sociedad : null,
          numero_cuenta: needsDatosBancarios ? form.numero_cuenta : null,
          tipo_documento_tributario: needsFacturacion ? form.tipo_documento_tributario : null,
          tiene_certificado_digital: needsFacturacion ? form.tiene_certificado_digital : null,
          certificado_opcion: needsFacturacion && form.tiene_certificado_digital === false ? form.certificado_opcion : null,
          bancos_conciliacion: needsConciliacion ? form.bancos_conciliacion.map(b => b.label) : null,
          archivo_escritura: escritura,
          archivo_cedula_rl: cedula_rl,
          archivo_erut: erut,
          archivo_cedula_rl_cert: cedula_cert,
          estado: 'pendiente',
        })
        .select()
        .single()

      if (dbError) throw dbError

      // 3. Disparar función de notificación por correo
      await fetch('/.netlify/functions/notify-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: onboarding.id }),
      })

      setSubmitted(true)
    } catch (err) {
      console.error(err)
      setError('Ocurrió un error al enviar el formulario. Por favor intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow p-10 max-w-md text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">¡Formulario enviado!</h2>
          <p className="text-gray-600">Hemos recibido tu información. Nos pondremos en contacto contigo a la brevedad para continuar con el proceso de onboarding.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Formulario de Onboarding</h1>
          <p className="text-gray-500 mt-2">Completa la información para iniciar tu proceso de afiliación</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* SECCIÓN 1: Datos de la sociedad */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <SectionTitle>Datos de la Sociedad</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <Field label="Razón Social" required>
                <Input value={form.razon_social} onChange={e => set('razon_social', e.target.value)} required />
              </Field>
              <Field label="Nombre de Fantasía">
                <Input value={form.nombre_fantasia} onChange={e => set('nombre_fantasia', e.target.value)} />
              </Field>
              <Field label="RUT de la Sociedad" required hint="Ej: 76.123.456-7">
                <Input value={form.rut_sociedad} onChange={e => set('rut_sociedad', e.target.value)} required placeholder="76.123.456-7" />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <Field label="Dirección" required>
                <Input value={form.direccion} onChange={e => set('direccion', e.target.value)} required />
              </Field>
              <Field label="Oficina / Depto (opcional)">
                <Input value={form.oficina} onChange={e => set('oficina', e.target.value)} />
              </Field>
              <Field label="Comuna" required>
                <Input value={form.comuna} onChange={e => set('comuna', e.target.value)} required />
              </Field>
              <Field label="Región" required>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.region}
                  onChange={e => set('region', e.target.value)}
                  required
                >
                  <option value="">Selecciona una región</option>
                  {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Actividad Económica" required>
              <Select
                options={ACTIVIDADES_ECONOMICAS}
                value={form.actividad_economica}
                onChange={val => set('actividad_economica', val)}
                placeholder="Busca tu actividad económica..."
                noOptionsMessage={() => 'Sin resultados'}
                isClearable
                classNamePrefix="react-select"
                required
              />
            </Field>
          </div>

          {/* SECCIÓN 2: Representante Legal */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <SectionTitle>Representante Legal</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <Field label="Nombre Completo" required>
                <Input value={form.nombre_rl} onChange={e => set('nombre_rl', e.target.value)} required />
              </Field>
              <Field label="RUT" required hint="Ej: 12.345.678-9">
                <Input value={form.rut_rl} onChange={e => set('rut_rl', e.target.value)} required placeholder="12.345.678-9" />
              </Field>
              <Field label="Teléfono" required hint="Ej: +56 9 1234 5678">
                <Input type="tel" value={form.telefono_rl} onChange={e => set('telefono_rl', e.target.value)} required placeholder="+56 9 1234 5678" />
              </Field>
              <Field label="Correo Electrónico" required>
                <Input type="email" value={form.email_rl} onChange={e => set('email_rl', e.target.value)} required />
              </Field>
            </div>
          </div>

          {/* SECCIÓN 3: Productos */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <SectionTitle>Productos a Contratar</SectionTitle>
            <p className="text-sm text-gray-500 mb-4">Selecciona uno o más productos:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PRODUCTOS.map(p => (
                <label key={p.id} className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer transition-colors ${form.productos.includes(p.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="checkbox"
                    className="accent-blue-500"
                    checked={form.productos.includes(p.id)}
                    onChange={() => toggleProducto(p.id)}
                  />
                  <span className="text-sm font-medium text-gray-700">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* SECCIÓN 4: Medios de Pago */}
          {(needsMediosPago || needsPagosRecurrentes) && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <SectionTitle>Medios de Pago</SectionTitle>

              {needsMediosPago && (
                <>
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-600 mb-2">Pago Único</p>
                    <div className="flex flex-wrap gap-3">
                      {MEDIOS_PAGO.filter(m => m.tipo === 'unico').map(m => (
                        <label key={m.id} className={`flex items-center gap-2 border rounded-lg px-4 py-2 cursor-pointer transition-colors ${form.medios_pago.includes(m.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="checkbox" className="accent-blue-500" checked={form.medios_pago.includes(m.id)} onChange={() => toggleMedioPago(m.id)} />
                          <span className="text-sm font-medium text-gray-700">{m.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Pago Automático</p>
                    <div className="flex flex-wrap gap-3">
                      {MEDIOS_PAGO.filter(m => m.tipo === 'automatico').map(m => (
                        <label key={m.id} className={`flex items-center gap-2 border rounded-lg px-4 py-2 cursor-pointer transition-colors ${form.medios_pago.includes(m.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="checkbox" className="accent-blue-500" checked={form.medios_pago.includes(m.id)} onChange={() => toggleMedioPago(m.id)} />
                          <span className="text-sm font-medium text-gray-700">{m.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {needsPagosRecurrentes && !needsMediosPago && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  Webpay OneClick está incluido automáticamente para Pagos Recurrentes.
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN 5: Parámetros OneClick */}
          {needsOneclick && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <SectionTitle>Parámetros de Seguridad — Webpay OneClick</SectionTitle>
              {needsPagosRecurrentes && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 mb-4">
                  Webpay OneClick es obligatorio para Pagos Recurrentes.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
                <Field label="N° máximo de transacciones por tarjeta al día" required hint="Recomendación: 10">
                  <Input type="number" value={form.oneclick_max_transacciones} onChange={e => set('oneclick_max_transacciones', e.target.value)} required min="1" />
                </Field>
                <Field label="Monto máximo por transacción ($)" required hint="Recomendación: sobre $1.000.000">
                  <Input type="number" value={form.oneclick_monto_max} onChange={e => set('oneclick_monto_max', e.target.value)} required min="1" />
                </Field>
                <Field label="Monto acumulado máximo por tarjeta al día ($)" required hint="Recomendación: sobre $2.000.000">
                  <Input type="number" value={form.oneclick_monto_acumulado} onChange={e => set('oneclick_monto_acumulado', e.target.value)} required min="1" />
                </Field>
              </div>
            </div>
          )}

          {/* SECCIÓN 6: Datos Bancarios */}
          {needsDatosBancarios && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <SectionTitle>Datos Bancarios</SectionTitle>
              <Field label="Banco" required>
                <Select
                  options={BANCOS}
                  value={form.banco}
                  onChange={val => set('banco', val)}
                  placeholder="Selecciona un banco..."
                  isClearable
                  classNamePrefix="react-select"
                />
              </Field>
              <Field label="N° de Cuenta Bancaria" required>
                <Input value={form.numero_cuenta} onChange={e => set('numero_cuenta', e.target.value)} required />
              </Field>
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-blue-500"
                    checked={form.rut_titular_es_sociedad}
                    onChange={e => set('rut_titular_es_sociedad', e.target.checked)}
                  />
                  <span className="text-sm text-gray-700">El RUT del titular de la cuenta es el mismo que la sociedad ({form.rut_sociedad || 'ingresa el RUT arriba'})</span>
                </label>
              </div>
              {!form.rut_titular_es_sociedad && (
                <Field label="RUT del Titular de la Cuenta" required hint="Solo si es distinto al RUT de la sociedad">
                  <Input value={form.rut_titular_cuenta} onChange={e => set('rut_titular_cuenta', e.target.value)} required={!form.rut_titular_es_sociedad} placeholder="12.345.678-9" />
                </Field>
              )}
            </div>
          )}

          {/* SECCIÓN 7: Facturación Automática */}
          {needsFacturacion && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <SectionTitle>Facturación Automática</SectionTitle>
              <Field label="Tipo de documento tributario" required>
                <div className="flex gap-4">
                  {['Boleta', 'Factura'].map(tipo => (
                    <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-blue-500"
                        checked={form.tipo_documento_tributario.includes(tipo)}
                        onChange={() => toggleDocTributario(tipo)}
                      />
                      <span className="text-sm text-gray-700">{tipo}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="¿Cuentan con certificado digital?" required>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" className="accent-blue-500" name="cert" checked={form.tiene_certificado_digital === true} onChange={() => set('tiene_certificado_digital', true)} />
                    <span className="text-sm text-gray-700">Sí</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" className="accent-blue-500" name="cert" checked={form.tiene_certificado_digital === false} onChange={() => set('tiene_certificado_digital', false)} />
                    <span className="text-sm text-gray-700">No</span>
                  </label>
                </div>
              </Field>

              {form.tiene_certificado_digital === false && (
                <Field label="Adquirir certificado digital" required hint="Podemos proveer un certificado digital">
                  <div className="space-y-2">
                    {[
                      { value: '1_anio', label: 'Duración 1 año — $12.990' },
                      { value: '3_anios', label: 'Duración 3 años — $18.990' },
                    ].map(opt => (
                      <label key={opt.value} className={`flex items-center gap-2 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${form.certificado_opcion === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="radio" className="accent-blue-500" name="cert_opcion" value={opt.value} checked={form.certificado_opcion === opt.value} onChange={() => set('certificado_opcion', opt.value)} />
                        <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </Field>
              )}
            </div>
          )}

          {/* SECCIÓN 8: Conciliación Bancaria */}
          {needsConciliacion && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <SectionTitle>Conciliación Bancaria</SectionTitle>
              <Field label="Banco(s) a conciliar" required hint="Puedes seleccionar más de uno">
                <Select
                  options={BANCOS}
                  value={form.bancos_conciliacion}
                  onChange={val => set('bancos_conciliacion', val)}
                  placeholder="Selecciona banco(s)..."
                  isMulti
                  classNamePrefix="react-select"
                />
              </Field>
            </div>
          )}

          {/* SECCIÓN 9: Documentos */}
          {(needsDocumentos || (needsFacturacion && form.tiene_certificado_digital === false)) && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <SectionTitle>Documentos Requeridos</SectionTitle>
              <p className="text-sm text-gray-500 mb-4">Adjunta los documentos solicitados (PDF, imagen, etc.).</p>
              <div className="space-y-4">
                {needsDocumentos && (
                  <>
                    <Field label="Escritura de la Sociedad" required>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileChange('archivo_escritura', e)} required={needsDocumentos} className="text-sm text-gray-600" />
                    </Field>
                    <Field label="Copia Cédula de Identidad del Representante Legal" required>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileChange('archivo_cedula_rl', e)} required={needsDocumentos} className="text-sm text-gray-600" />
                    </Field>
                    <Field label="E-RUT (descargado desde el SII)" required>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileChange('archivo_erut', e)} required={needsDocumentos} className="text-sm text-gray-600" />
                    </Field>
                  </>
                )}
                {needsFacturacion && form.tiene_certificado_digital === false && (
                  <Field label="Copia Cédula de Identidad del Representante Legal (certificado digital)" required>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileChange('archivo_cedula_rl_cert', e)} required className="text-sm text-gray-600" />
                  </Field>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || form.productos.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors text-base"
          >
            {loading ? 'Enviando...' : 'Enviar Formulario'}
          </button>
        </form>
      </div>
    </div>
  )
}
