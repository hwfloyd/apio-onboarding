import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)

const PRODUCTO_LABELS = {
  link_pago: 'Link de Pago',
  checkout: 'Checkout',
  conciliacion: 'Conciliación Bancaria',
  facturacion: 'Facturación Automática',
  pagos_recurrentes: 'Pagos Recurrentes',
  portal_pagos: 'Portal de Pagos',
}

const MEDIO_LABELS = {
  webpay_plus: 'Webpay Plus',
  webpay_oneclick: 'Webpay OneClick',
  transferencias: 'Transferencias',
  mercadopago: 'MercadoPago',
}

function row(label, value) {
  if (!value && value !== false) return ''
  return `<tr><td style="padding:6px 12px;font-weight:500;color:#6b7280;background:#f9fafb;border:1px solid #e5e7eb">${label}</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${value}</td></tr>`
}

export const handler = async (event) => {
  const { id } = JSON.parse(event.body)

  const { data, error } = await supabase.from('onboardings').select('*').eq('id', id).single()
  if (error) return { statusCode: 500, body: 'Error fetching onboarding' }

  const productos = (data.productos || []).map(p => PRODUCTO_LABELS[p] || p).join(', ')
  const medios = (data.medios_pago || []).map(m => MEDIO_LABELS[m] || m).join(', ')

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:700px;margin:0 auto">
      <h2 style="color:#1e3a5f">Nuevo Onboarding — ${data.razon_social}</h2>
      <p style="color:#6b7280">Recibido el ${new Date(data.created_at).toLocaleString('es-CL')}</p>

      <h3 style="color:#374151;margin-top:24px">Datos de la Sociedad</h3>
      <table style="border-collapse:collapse;width:100%">
        ${row('Razón Social', data.razon_social)}
        ${row('Nombre de Fantasía', data.nombre_fantasia)}
        ${row('RUT Sociedad', data.rut_sociedad)}
        ${row('Dirección', `${data.direccion}${data.oficina ? `, ${data.oficina}` : ''}`)}
        ${row('Comuna', data.comuna)}
        ${row('Región', data.region)}
        ${row('Actividad Económica', data.actividad_economica)}
      </table>

      <h3 style="color:#374151;margin-top:24px">Representante Legal</h3>
      <table style="border-collapse:collapse;width:100%">
        ${row('Nombre', data.nombre_rl)}
        ${row('RUT', data.rut_rl)}
        ${row('Teléfono', data.telefono_rl)}
        ${row('Email', data.email_rl)}
      </table>

      <h3 style="color:#374151;margin-top:24px">Productos Contratados</h3>
      <table style="border-collapse:collapse;width:100%">
        ${row('Productos', productos)}
        ${medios ? row('Medios de Pago', medios) : ''}
        ${data.oneclick_max_transacciones ? row('OneClick — Máx. transacciones/día', data.oneclick_max_transacciones) : ''}
        ${data.oneclick_monto_max ? row('OneClick — Monto máx. transacción', `$${Number(data.oneclick_monto_max).toLocaleString('es-CL')}`) : ''}
        ${data.oneclick_monto_acumulado ? row('OneClick — Monto acumulado máx./día', `$${Number(data.oneclick_monto_acumulado).toLocaleString('es-CL')}`) : ''}
        ${data.banco_label ? row('Banco', data.banco_label) : ''}
        ${data.numero_cuenta ? row('N° Cuenta', data.numero_cuenta) : ''}
        ${data.rut_titular_es_sociedad ? row('RUT Titular Cuenta', `${data.rut_sociedad} (misma sociedad)`) : (data.rut_titular_cuenta ? row('RUT Titular Cuenta', data.rut_titular_cuenta) : '')}
        ${data.tipo_documento_tributario?.length ? row('Doc. Tributario', data.tipo_documento_tributario.join(', ')) : ''}
        ${data.tiene_certificado_digital !== null ? row('Certificado Digital', data.tiene_certificado_digital ? 'Sí (propio)' : `No — opción: ${data.certificado_opcion || '-'}`) : ''}
        ${data.bancos_conciliacion?.length ? row('Bancos Conciliación', data.bancos_conciliacion.join(', ')) : ''}
      </table>

      <p style="margin-top:24px">
        <a href="${process.env.SITE_URL}/admin/onboarding/${id}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:500">
          Ver en Backoffice →
        </a>
      </p>
    </div>
  `

  await resend.emails.send({
    from: 'Apio Onboarding <noreply@apio.cl>',
    to: process.env.ADMIN_EMAIL,
    subject: `Nuevo Onboarding: ${data.razon_social}`,
    html,
  })

  return { statusCode: 200, body: 'OK' }
}
