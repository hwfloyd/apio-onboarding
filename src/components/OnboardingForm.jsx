import { useState } from 'react'
import Select from 'react-select'
import { supabase } from '../lib/supabase'
import { ACTIVIDADES_ECONOMICAS, BANCOS, REGIONES } from '../lib/actividadesEconomicas'

// ─── Data ─────────────────────────────────────────────────────────────────────

const PRODUCTOS = [
  { id: 'link_pago',         label: 'Link de Pago',           emoji: '🔗' },
  { id: 'checkout',          label: 'Checkout',               emoji: '🛒' },
  { id: 'conciliacion',      label: 'Conciliación Bancaria',  emoji: '📊' },
  { id: 'facturacion',       label: 'Facturación Automática', emoji: '🧾' },
  { id: 'pagos_recurrentes', label: 'Pagos Recurrentes',      emoji: '🔄' },
  { id: 'portal_pagos',      label: 'Portal de Pagos',        emoji: '💳' },
]

const MEDIOS_PAGO = [
  { id: 'webpay_plus',     label: 'Webpay Plus',     sub: 'Pago único',      emoji: '💳' },
  { id: 'webpay_oneclick', label: 'Webpay OneClick', sub: 'Pago automático', emoji: '⚡' },
  { id: 'transferencias',  label: 'Transferencias',  sub: 'Pago único',      emoji: '🏦' },
  { id: 'mercadopago',     label: 'MercadoPago',     sub: 'Pago único',      emoji: '💙' },
]

const PRODUCTOS_CON_MEDIOS_PAGO = ['link_pago', 'checkout', 'portal_pagos']
const PRODUCTOS_CON_DOCUMENTOS  = ['link_pago', 'checkout', 'pagos_recurrentes', 'portal_pagos']

const STEP_LABELS = {
  representante: 'Tus datos',
  empresa:       'Tu empresa',
  ubicacion:     'Ubicación',
  productos:     'Productos',
  medios_pago:   'Medios de pago',
  oneclick:      'Webpay OneClick',
  bancarios:     'Datos bancarios',
  facturacion:   'Facturación',
  conciliacion:  'Conciliación',
  documentos:    'Documentos',
}

const initialForm = {
  razon_social: '', nombre_fantasia: '', rut_sociedad: '',
  direccion: '', oficina: '', comuna: '', region: '',
  nombre_rl: '', rut_rl: '', telefono_rl: '', email_rl: '',
  actividad_economica: null,
  productos: [], medios_pago: [],
  oneclick_max_transacciones: '10', oneclick_monto_max: '1000000', oneclick_monto_acumulado: '2000000',
  banco: null, rut_titular_cuenta: '', rut_titular_es_sociedad: false, numero_cuenta: '',
  tipo_documento_tributario: [], tiene_certificado_digital: null, certificado_opcion: null,
  bancos_conciliacion: [],
  archivo_escritura: null, archivo_cedula_rl: null, archivo_erut: null, archivo_cedula_rl_cert: null,
}

// ─── Step list (dynamic) ──────────────────────────────────────────────────────

function getStepList({ productos, medios_pago, tiene_certificado_digital }) {
  const needsMediosPago   = PRODUCTOS_CON_MEDIOS_PAGO.some(p => productos.includes(p))
  const needsPagosRec     = productos.includes('pagos_recurrentes')
  const needsOneclick     = medios_pago.includes('webpay_oneclick') || needsPagosRec
  const needsDatosBanc    = medios_pago.includes('webpay_plus') || medios_pago.includes('webpay_oneclick')
  const needsFacturacion  = productos.includes('facturacion')
  const needsConciliacion = productos.includes('conciliacion')
  const needsDocumentos   = PRODUCTOS_CON_DOCUMENTOS.some(p => productos.includes(p))
  const needsCertDoc      = needsFacturacion && tiene_certificado_digital === false

  const steps = ['representante', 'empresa', 'ubicacion', 'productos']
  if (needsMediosPago || needsPagosRec)  steps.push('medios_pago')
  if (needsOneclick)                     steps.push('oneclick')
  if (needsDatosBanc)                    steps.push('bancarios')
  if (needsFacturacion)                  steps.push('facturacion')
  if (needsConciliacion)                 steps.push('conciliacion')
  if (needsDocumentos || needsCertDoc)   steps.push('documentos')
  return steps
}

// ─── Design system components ─────────────────────────────────────────────────

function ChatBubble({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--green-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>A</span>
      </div>
      <div style={{
        background: 'var(--green-light)', border: '1px solid var(--green-border)',
        borderRadius: '4px 16px 16px 16px',
        padding: '12px 16px', fontSize: 14, fontWeight: 700,
        color: 'var(--gray-700)', lineHeight: 1.55, maxWidth: '80%',
      }}>
        {children}
      </div>
    </div>
  )
}

function PrimaryButton({ children, onClick, disabled, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? 'var(--gray-200)' : 'var(--green-primary)',
        color: disabled ? 'var(--gray-400)' : 'var(--green-dark-1)',
        padding: '0 22px', minHeight: 44, borderRadius: 8,
        fontSize: 14, fontWeight: 700, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none', border: 'none',
        fontSize: 12, color: 'var(--gray-400)',
        minHeight: 44, padding: '4px 0', cursor: 'pointer',
      }}
    >
      ← Volver
    </button>
  )
}

function TextInput({ label, error, value = '', ...props }) {
  const [focused, setFocused] = useState(false)
  const filled = value !== '' && value != null
  let borderColor = error ? '#F87171' : (filled || focused) ? 'var(--green-primary)' : 'var(--gray-200)'
  let bg = (filled || focused || error) ? '#fff' : 'var(--gray-50)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500 }}>{label}</label>}
      <input
        value={value}
        {...props}
        onFocus={e => { setFocused(true); props.onFocus?.(e) }}
        onBlur={e => { setFocused(false); props.onBlur?.(e) }}
        aria-invalid={!!error}
        style={{
          fontSize: 16, padding: '11px 14px', borderRadius: 8,
          minHeight: 44, border: `1.5px solid ${borderColor}`,
          background: bg, outline: 'none',
          transition: 'border-color 0.15s',
          width: '100%', boxSizing: 'border-box', color: 'var(--text-dark)',
        }}
      />
      {error && <span style={{ fontSize: 12, color: '#EF4444' }}>{error}</span>}
    </div>
  )
}

function OptionCard({ label, sublabel, emoji, selected, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      style={{
        padding: '10px 12px', borderRadius: 8, minHeight: 44,
        textAlign: 'left',
        border: `1.5px solid ${selected ? 'var(--green-primary)' : 'var(--gray-200)'}`,
        background: selected ? 'var(--green-light)' : 'var(--gray-50)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        display: 'flex', flexDirection: 'column', gap: 2,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {emoji && <span style={{ fontSize: 18 }}>{emoji}</span>}
      <span style={{ fontSize: 13, fontWeight: 600, color: selected ? '#166534' : 'var(--gray-700)' }}>
        {label}
      </span>
      {sublabel && <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{sublabel}</span>}
    </button>
  )
}

function OptionGrid({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {children}
    </div>
  )
}

function FileInput({ label, accept, onChange, file }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, display: 'block', marginBottom: 6 }}>
        {label} *
      </label>
      <div style={{
        border: `1.5px dashed ${file ? 'var(--green-primary)' : 'var(--gray-200)'}`,
        borderRadius: 8, padding: '10px 14px', minHeight: 44,
        background: file ? 'var(--green-light)' : 'var(--gray-50)',
        display: 'flex', alignItems: 'center', gap: 10,
        transition: 'border-color 0.15s, background 0.15s',
      }}>
        <input
          type="file"
          accept={accept}
          onChange={onChange}
          style={{ flex: 1, fontSize: 13, color: 'var(--gray-700)' }}
        />
        {file && <span style={{ fontSize: 11, color: 'var(--green-primary)', fontWeight: 700, flexShrink: 0 }}>✓</span>}
      </div>
    </div>
  )
}

function ProgressIndicator({ stepId, stepList }) {
  const idx    = stepList.indexOf(stepId)
  const total  = stepList.length
  const pct    = ((idx + 1) / total) * 100
  const isLast = idx === total - 1
  const label  = STEP_LABELS[stepId] || stepId
  const timeEst = isLast
    ? '¡Último paso!'
    : idx < Math.floor(total * 0.33) ? '~3 min en total'
    : idx < Math.floor(total * 0.66) ? '~2 min restantes'
    : '~1 min restante'

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--green-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
        <span style={{ fontSize: 10, color: isLast ? 'var(--green-primary)' : 'var(--gray-400)', fontWeight: isLast ? 700 : 400 }}>
          {timeEst}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso: paso ${idx + 1} de ${total}`}
        style={{ background: 'var(--green-light)', height: 3, borderRadius: 4, overflow: 'hidden' }}
      >
        <div style={{ background: 'var(--green-primary)', height: '100%', width: `${pct}%`, borderRadius: 4, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  )
}

// ─── React-Select styles ──────────────────────────────────────────────────────

const selectStyles = {
  control: (base, { isFocused, hasValue }) => ({
    ...base,
    borderColor: isFocused || hasValue ? '#22C55E' : '#E2E8F0',
    borderWidth: '1.5px', borderRadius: 8, minHeight: 44,
    fontSize: 16, backgroundColor: hasValue ? '#fff' : '#F8FAFC',
    boxShadow: 'none', '&:hover': { borderColor: '#22C55E' },
  }),
  option: (base, { isSelected, isFocused }) => ({
    ...base, fontSize: 14,
    backgroundColor: isSelected ? '#F0FDF4' : isFocused ? '#F8FAFC' : '#fff',
    color: isSelected ? '#166534' : '#374151',
  }),
  placeholder: base => ({ ...base, fontSize: 14, color: '#94A3B8' }),
  singleValue:  base => ({ ...base, fontSize: 14, color: '#0F172A' }),
  multiValue:   base => ({ ...base, backgroundColor: '#F0FDF4', borderRadius: 6 }),
  multiValueLabel:  base => ({ ...base, color: '#166534', fontSize: 13 }),
  multiValueRemove: base => ({ ...base, color: '#86EFAC', ':hover': { backgroundColor: '#BBF7D0', color: '#166534' } }),
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingForm() {
  const [form, setForm]           = useState(initialForm)
  const [loading, setLoading]     = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError]         = useState(null)
  const [stepId, setStepId]       = useState('representante')
  const [direction, setDirection] = useState('forward')
  const [animKey, setAnimKey]     = useState(0)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const toggleProducto = (id) => {
    setForm(f => {
      const productos = f.productos.includes(id)
        ? f.productos.filter(p => p !== id)
        : [...f.productos, id]
      let medios_pago = f.medios_pago
      if (!productos.includes('pagos_recurrentes') && !PRODUCTOS_CON_MEDIOS_PAGO.some(p => productos.includes(p))) {
        medios_pago = []
      }
      return { ...f, productos, medios_pago }
    })
  }

  const toggleMedioPago = (id) => {
    if (id === 'webpay_oneclick' && form.productos.includes('pagos_recurrentes') && !PRODUCTOS_CON_MEDIOS_PAGO.some(p => form.productos.includes(p))) return
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

  const handleFileChange = (field, e) => set(field, e.target.files[0] || null)

  // Derived (same logic as original)
  const needsMediosPago     = PRODUCTOS_CON_MEDIOS_PAGO.some(p => form.productos.includes(p))
  const needsDocumentos     = PRODUCTOS_CON_DOCUMENTOS.some(p => form.productos.includes(p))
  const needsOneclick       = form.medios_pago.includes('webpay_oneclick') || form.productos.includes('pagos_recurrentes')
  const needsDatosBancarios = form.medios_pago.includes('webpay_plus') || form.medios_pago.includes('webpay_oneclick')
  const needsPagosRecurrentes = form.productos.includes('pagos_recurrentes')
  const needsFacturacion    = form.productos.includes('facturacion')
  const needsConciliacion   = form.productos.includes('conciliacion')

  const stepList   = getStepList(form)
  const stepIdx    = stepList.indexOf(stepId)
  const isLastStep = stepIdx === stepList.length - 1
  const isHalfway  = stepIdx === Math.floor(stepList.length / 2) && stepList.length > 4

  const canAdvance = () => {
    switch (stepId) {
      case 'representante':
        return !!(form.nombre_rl && form.rut_rl && form.telefono_rl && form.email_rl)
      case 'empresa':
        return !!(form.razon_social && form.rut_sociedad)
      case 'ubicacion':
        return !!(form.direccion && form.comuna && form.region && form.actividad_economica)
      case 'productos':
        return form.productos.length > 0
      case 'medios_pago':
        return form.medios_pago.length > 0 || (needsPagosRecurrentes && !needsMediosPago)
      case 'oneclick':
        return !!(form.oneclick_max_transacciones && form.oneclick_monto_max && form.oneclick_monto_acumulado)
      case 'bancarios':
        return !!(form.banco && form.numero_cuenta && (form.rut_titular_es_sociedad === true || form.rut_titular_cuenta))
      case 'facturacion':
        return form.tipo_documento_tributario.length > 0 &&
          form.tiene_certificado_digital !== null &&
          (form.tiene_certificado_digital === true || !!form.certificado_opcion)
      case 'conciliacion':
        return form.bancos_conciliacion.length > 0
      case 'documentos': {
        const docOk  = !needsDocumentos || !!(form.archivo_escritura && form.archivo_cedula_rl && form.archivo_erut)
        const certOk = !(needsFacturacion && form.tiene_certificado_digital === false) || !!form.archivo_cedula_rl_cert
        return docOk && certOk
      }
      default:
        return true
    }
  }

  const navigate = (dir) => {
    const nextIdx = dir === 'forward' ? stepIdx + 1 : stepIdx - 1
    const nextId  = stepList[nextIdx]
    if (!nextId) return
    setDirection(dir)
    setStepId(nextId)
    setAnimKey(k => k + 1)
    window.scrollTo(0, 0)
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const uploadFile = async (file, path) => {
        if (!file) return null
        const ext = file.name.includes('.') ? `.${file.name.split('.').pop().toLowerCase()}` : ''
        const { data, error } = await supabase.storage
          .from('onboarding-docs')
          .upload(`${path}${ext}`, file, { upsert: true, contentType: file.type || undefined })
        if (error) throw error
        return data.path
      }
      const timestamp = Date.now()
      const folder = `${timestamp}_${form.rut_sociedad.replace(/\./g, '').replace('-', '')}`
      const [escritura, cedula_rl, erut, cedula_cert] = await Promise.all([
        uploadFile(form.archivo_escritura,    `${folder}/escritura_sociedad`),
        uploadFile(form.archivo_cedula_rl,    `${folder}/cedula_rl`),
        uploadFile(form.archivo_erut,         `${folder}/erut`),
        uploadFile(form.archivo_cedula_rl_cert, `${folder}/cedula_rl_certificado`),
      ])
      const res = await fetch('/.netlify/functions/submit-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razon_social: form.razon_social, nombre_fantasia: form.nombre_fantasia,
          rut_sociedad: form.rut_sociedad, direccion: form.direccion,
          oficina: form.oficina, comuna: form.comuna, region: form.region,
          nombre_rl: form.nombre_rl, rut_rl: form.rut_rl,
          telefono_rl: form.telefono_rl, email_rl: form.email_rl,
          actividad_economica: form.actividad_economica?.label || null,
          productos: form.productos, medios_pago: form.medios_pago,
          oneclick_max_transacciones: needsOneclick ? form.oneclick_max_transacciones : null,
          oneclick_monto_max:         needsOneclick ? form.oneclick_monto_max : null,
          oneclick_monto_acumulado:   needsOneclick ? form.oneclick_monto_acumulado : null,
          banco:              needsDatosBancarios ? form.banco?.value : null,
          banco_label:        needsDatosBancarios ? form.banco?.label : null,
          rut_titular_cuenta: needsDatosBancarios && !form.rut_titular_es_sociedad ? form.rut_titular_cuenta : null,
          rut_titular_es_sociedad: needsDatosBancarios ? form.rut_titular_es_sociedad : null,
          numero_cuenta:      needsDatosBancarios ? form.numero_cuenta : null,
          tipo_documento_tributario: needsFacturacion ? form.tipo_documento_tributario : null,
          tiene_certificado_digital: needsFacturacion ? form.tiene_certificado_digital : null,
          certificado_opcion: needsFacturacion && form.tiene_certificado_digital === false ? form.certificado_opcion : null,
          bancos_conciliacion: needsConciliacion ? form.bancos_conciliacion.map(b => b.label) : null,
          archivo_escritura: escritura, archivo_cedula_rl: cedula_rl,
          archivo_erut: erut, archivo_cedula_rl_cert: cedula_cert,
          estado: 'pendiente',
        }),
      })
      if (!res.ok) throw new Error('Error al guardar el formulario')
      setSubmitted(true)
    } catch (err) {
      console.error(err)
      setError('Ocurrió un error al enviar el formulario. Por favor intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return
    const tag  = e.target.tagName
    const role = e.target.getAttribute('role')
    if (tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'SELECT' || role === 'combobox' || role === 'option') return
    e.preventDefault()
    if (canAdvance()) isLastStep ? handleSubmit() : navigate('forward')
  }

  // ── Submitted ────────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--white)' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: '40px 24px' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--green-light)', border: '2px solid var(--green-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: 28,
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-dark)', margin: '0 0 12px', letterSpacing: '-0.4px' }}>
            ¡Formulario enviado!
          </h2>
          <p style={{ fontSize: 14, color: 'var(--gray-400)', lineHeight: 1.6, margin: 0 }}>
            Hemos recibido tu información. Nos pondremos en contacto contigo a la brevedad para continuar con el proceso de onboarding.
          </p>
        </div>
      </div>
    )
  }

  // ── Step content ─────────────────────────────────────────────────────────────

  const nombre  = form.nombre_rl.split(' ')[0] || ''
  const empresa = form.razon_social || 'tu empresa'

  const navRow = (
    <div style={{ display: 'flex', justifyContent: stepIdx > 0 ? 'space-between' : 'flex-end', alignItems: 'center', marginTop: 8 }}>
      {stepIdx > 0 && <BackButton onClick={() => navigate('backward')} />}
      <PrimaryButton onClick={isLastStep ? handleSubmit : () => navigate('forward')} disabled={!canAdvance() || loading}>
        {isLastStep ? (loading ? 'Enviando...' : 'Enviar formulario') : 'Continuar →'}
      </PrimaryButton>
    </div>
  )

  const STEPS = {
    representante: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ChatBubble>¿Con quién estamos hablando? Cuéntanos sobre el representante legal de tu empresa.</ChatBubble>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TextInput label="Nombre completo" value={form.nombre_rl} onChange={e => set('nombre_rl', e.target.value)} placeholder="María González" />
          <TextInput label="RUT — Ej: 12.345.678-9" value={form.rut_rl} onChange={e => set('rut_rl', e.target.value)} placeholder="12.345.678-9" />
          <TextInput label="Teléfono" type="tel" value={form.telefono_rl} onChange={e => set('telefono_rl', e.target.value)} placeholder="+56 9 1234 5678" />
          <TextInput label="Correo electrónico" type="email" value={form.email_rl} onChange={e => set('email_rl', e.target.value)} placeholder="maria@empresa.cl" />
        </div>
        {navRow}
      </div>
    ),

    empresa: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ChatBubble>{nombre ? `Hola, ${nombre}. Cuéntanos sobre tu empresa.` : 'Cuéntanos sobre tu empresa.'}</ChatBubble>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TextInput label="Razón Social" value={form.razon_social} onChange={e => set('razon_social', e.target.value)} placeholder="Mi Empresa SpA" />
          <TextInput label="Nombre de Fantasía (opcional)" value={form.nombre_fantasia} onChange={e => set('nombre_fantasia', e.target.value)} placeholder="Mi Marca" />
          <TextInput label="RUT de la Sociedad — Ej: 76.123.456-7" value={form.rut_sociedad} onChange={e => set('rut_sociedad', e.target.value)} placeholder="76.123.456-7" />
        </div>
        {navRow}
      </div>
    ),

    ubicacion: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ChatBubble>¿Dónde está ubicada {empresa}?</ChatBubble>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <TextInput label="Dirección" value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Av. Providencia 1234" />
          </div>
          <TextInput label="Oficina / Depto (opcional)" value={form.oficina} onChange={e => set('oficina', e.target.value)} placeholder="Piso 3" />
          <TextInput label="Comuna" value={form.comuna} onChange={e => set('comuna', e.target.value)} placeholder="Providencia" />
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Región</label>
            <select
              value={form.region}
              onChange={e => set('region', e.target.value)}
              aria-label="Región"
              style={{
                width: '100%', fontSize: 16, padding: '11px 14px',
                borderRadius: 8, minHeight: 44, outline: 'none',
                border: `1.5px solid ${form.region ? 'var(--green-primary)' : 'var(--gray-200)'}`,
                background: form.region ? '#fff' : 'var(--gray-50)',
                color: form.region ? 'var(--text-dark)' : 'var(--gray-400)',
                transition: 'border-color 0.15s', boxSizing: 'border-box',
              }}
            >
              <option value="">Selecciona una región</option>
              {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Actividad Económica</label>
            <Select
              options={ACTIVIDADES_ECONOMICAS}
              value={form.actividad_economica}
              onChange={val => set('actividad_economica', val)}
              placeholder="Busca tu actividad económica..."
              noOptionsMessage={() => 'Sin resultados'}
              isClearable
              styles={selectStyles}
              aria-label="Actividad Económica"
            />
          </div>
        </div>
        {navRow}
      </div>
    ),

    productos: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ChatBubble>¿Qué productos de Apio necesitas{nombre ? `, ${nombre}` : ''}?</ChatBubble>
        <OptionGrid>
          {PRODUCTOS.map(p => (
            <OptionCard
              key={p.id}
              label={p.label}
              emoji={p.emoji}
              selected={form.productos.includes(p.id)}
              onClick={() => toggleProducto(p.id)}
            />
          ))}
        </OptionGrid>
        {navRow}
      </div>
    ),

    medios_pago: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ChatBubble>¿Qué medios de pago quieres activar?</ChatBubble>
        {needsPagosRecurrentes && !needsMediosPago ? (
          <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-border)', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#166534', lineHeight: 1.5 }}>
            Webpay OneClick está incluido automáticamente para Pagos Recurrentes.
          </div>
        ) : (
          <OptionGrid>
            {MEDIOS_PAGO.map(m => (
              <OptionCard
                key={m.id}
                label={m.label}
                sublabel={m.sub}
                emoji={m.emoji}
                selected={form.medios_pago.includes(m.id)}
                disabled={m.id === 'webpay_oneclick' && needsPagosRecurrentes && !needsMediosPago}
                onClick={() => toggleMedioPago(m.id)}
              />
            ))}
          </OptionGrid>
        )}
        {navRow}
      </div>
    ),

    oneclick: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ChatBubble>Configuremos los límites de seguridad para Webpay OneClick.</ChatBubble>
        {needsPagosRecurrentes && (
          <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-border)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#166534' }}>
            Webpay OneClick es obligatorio para Pagos Recurrentes.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TextInput label="N° máximo de transacciones por tarjeta al día — Recomendación: 10" type="number" value={form.oneclick_max_transacciones} onChange={e => set('oneclick_max_transacciones', e.target.value)} min="1" />
          <TextInput label="Monto máximo por transacción ($) — Recomendación: sobre $1.000.000" type="number" value={form.oneclick_monto_max} onChange={e => set('oneclick_monto_max', e.target.value)} min="1" />
          <TextInput label="Monto acumulado máximo por tarjeta al día ($) — Recomendación: sobre $2.000.000" type="number" value={form.oneclick_monto_acumulado} onChange={e => set('oneclick_monto_acumulado', e.target.value)} min="1" />
        </div>
        {navRow}
      </div>
    ),

    bancarios: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ChatBubble>¿A qué cuenta depositamos tus fondos?</ChatBubble>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Banco</label>
            <Select options={BANCOS} value={form.banco} onChange={val => set('banco', val)} placeholder="Selecciona un banco..." isClearable styles={selectStyles} aria-label="Banco" />
          </div>
          <TextInput label="N° de Cuenta Bancaria" value={form.numero_cuenta} onChange={e => set('numero_cuenta', e.target.value)} placeholder="123456789" />
          <div>
            <p style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, margin: '0 0 8px' }}>¿El titular de la cuenta es la misma sociedad?</p>
            <OptionGrid>
              <OptionCard
                label={`Sí — ${form.rut_sociedad || 'mismo RUT'}`}
                selected={form.rut_titular_es_sociedad === true}
                onClick={() => set('rut_titular_es_sociedad', true)}
              />
              <OptionCard
                label="No — distinto titular"
                selected={form.rut_titular_es_sociedad === false}
                onClick={() => set('rut_titular_es_sociedad', false)}
              />
            </OptionGrid>
          </div>
          {form.rut_titular_es_sociedad === false && (
            <TextInput label="RUT del Titular de la Cuenta — Solo si es distinto al RUT de la sociedad" value={form.rut_titular_cuenta} onChange={e => set('rut_titular_cuenta', e.target.value)} placeholder="12.345.678-9" />
          )}
        </div>
        {navRow}
      </div>
    ),

    facturacion: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ChatBubble>Configuremos la facturación automática.</ChatBubble>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, margin: '0 0 8px' }}>Tipo de documento tributario</p>
            <OptionGrid>
              {['Boleta', 'Factura'].map(tipo => (
                <OptionCard key={tipo} label={tipo} selected={form.tipo_documento_tributario.includes(tipo)} onClick={() => toggleDocTributario(tipo)} />
              ))}
            </OptionGrid>
          </div>
          <div>
            <p style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, margin: '0 0 8px' }}>¿Cuentan con certificado digital?</p>
            <OptionGrid>
              <OptionCard label="Sí, tenemos" selected={form.tiene_certificado_digital === true} onClick={() => set('tiene_certificado_digital', true)} />
              <OptionCard label="No, necesitamos uno" selected={form.tiene_certificado_digital === false} onClick={() => set('tiene_certificado_digital', false)} />
            </OptionGrid>
          </div>
          {form.tiene_certificado_digital === false && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, margin: '0 0 8px' }}>Adquirir certificado digital</p>
              <OptionGrid>
                {[
                  { value: '1_anio',  label: 'Duración 1 año',  sub: '$12.990' },
                  { value: '3_anios', label: 'Duración 3 años', sub: '$18.990' },
                ].map(opt => (
                  <OptionCard key={opt.value} label={opt.label} sublabel={opt.sub} selected={form.certificado_opcion === opt.value} onClick={() => set('certificado_opcion', opt.value)} />
                ))}
              </OptionGrid>
            </div>
          )}
        </div>
        {navRow}
      </div>
    ),

    conciliacion: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ChatBubble>¿Qué banco(s) vamos a conciliar?</ChatBubble>
        <div>
          <label style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Banco(s) a conciliar</label>
          <Select options={BANCOS} value={form.bancos_conciliacion} onChange={val => set('bancos_conciliacion', val)} placeholder="Selecciona banco(s)..." isMulti styles={selectStyles} aria-label="Bancos para conciliación" />
        </div>
        {navRow}
      </div>
    ),

    documentos: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ChatBubble>Para finalizar, necesitamos algunos documentos de la empresa.</ChatBubble>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {needsDocumentos && (
            <>
              <FileInput label="Escritura de la Sociedad" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileChange('archivo_escritura', e)} file={form.archivo_escritura} />
              <FileInput label="Copia Cédula de Identidad del Representante Legal" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileChange('archivo_cedula_rl', e)} file={form.archivo_cedula_rl} />
              <FileInput label="E-RUT (descargado desde el SII)" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileChange('archivo_erut', e)} file={form.archivo_erut} />
            </>
          )}
          {needsFacturacion && form.tiene_certificado_digital === false && (
            <FileInput label="Copia Cédula de Identidad del RL (certificado digital)" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileChange('archivo_cedula_rl_cert', e)} file={form.archivo_cedula_rl_cert} />
          )}
        </div>
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#DC2626' }}>
            {error}
          </div>
        )}
        {navRow}
      </div>
    ),
  }

  // ── Layout ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', minHeight: '100svh' }} onKeyDown={handleKeyDown}>

      {/* Desktop panel */}
      <div
        className="hidden md:flex"
        style={{
          width: 280, flexShrink: 0,
          background: 'linear-gradient(175deg, #052E16 0%, #0A3D1F 55%, #052E16 100%)',
          padding: '32px 24px', flexDirection: 'column', gap: 24,
        }}
      >
        <div>
          <p style={{ fontSize: 9, fontWeight: 500, color: 'var(--green-text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 8px' }}>Bienvenido a</p>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>APIO</span>
        </div>

        <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.3, letterSpacing: '-0.4px', margin: 0 }}>
          Conecta tu negocio con los mejores medios de pago de Chile
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { n: '+300',   l: 'Empresas activas' },
            { n: '99.9%',  l: 'Uptime' },
            { n: '< 5 días', l: 'Para activar' },
            { n: '24/7',   l: 'Soporte' },
          ].map(s => (
            <div key={s.l}>
              <p style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-1px', lineHeight: 1 }}>{s.n}</p>
              <p style={{ fontSize: 11, color: 'var(--green-text-dim)', margin: '4px 0 0', fontWeight: 500 }}>{s.l}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {['Empresa A', 'Empresa B', 'Empresa C', 'Empresa D'].map(c => (
            <div key={c} style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 7, padding: '8px 6px', minHeight: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{c}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.20)', borderRadius: 8, padding: '12px 14px', marginTop: 'auto' }}>
          <p style={{ fontSize: 11, color: 'var(--green-border)', fontStyle: 'italic', lineHeight: 1.6, margin: '0 0 8px' }}>
            "El proceso de integración fue mucho más rápido de lo que esperaba."
          </p>
          <p style={{ fontSize: 10, color: 'var(--green-text-muted)', fontWeight: 600, margin: 0 }}>
            — Representante Legal, Cliente Apio
          </p>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', minHeight: '100svh' }}>

        {/* Mobile header */}
        <div
          className="flex md:hidden"
          style={{
            height: 40, flexShrink: 0,
            background: 'linear-gradient(135deg, #052E16, #0A3D1F)',
            padding: '0 16px', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>APIO</span>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1 }}>+300</p>
            <p style={{ fontSize: 9, fontWeight: 500, color: 'var(--green-text-muted)', margin: 0, letterSpacing: '0.06em' }}>EMPRESAS</p>
          </div>
        </div>

        {/* Form area */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 24px 40px', flex: 1, width: '100%' }}>

            <ProgressIndicator stepId={stepId} stepList={stepList} />

            {isHalfway && (
              <p style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', marginBottom: 16 }}>
                ¡Vas muy bien! Ya casi terminamos.
              </p>
            )}

            <div
              key={animKey}
              style={{ animation: `${direction === 'forward' ? 'slideInForward' : 'slideInBackward'} 180ms cubic-bezier(0.25,0,0,1)` }}
            >
              {STEPS[stepId]}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
