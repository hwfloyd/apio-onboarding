import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)

async function downloadAttachment(path, filename) {
  if (!path) return null
  const { data, error } = await supabase.storage.from('onboarding-docs').download(path)
  if (error || !data) return null
  const buffer = Buffer.from(await data.arrayBuffer())
  return { filename, content: buffer.toString('base64') }
}

export const handler = async (event) => {
  try {
    const { id, subject, html } = JSON.parse(event.body)

    const { data, error } = await supabase.from('onboardings').select('*').eq('id', id).single()
    if (error) return { statusCode: 500, body: JSON.stringify({ error: 'Error fetching onboarding' }) }

    if (!process.env.TRANSBANK_EXECUTIVE_EMAIL) {
      return { statusCode: 500, body: JSON.stringify({ error: 'TRANSBANK_EXECUTIVE_EMAIL no está configurado en las variables de entorno.' }) }
    }

    const rut = data.rut_sociedad?.replace(/\./g, '').replace('-', '') || id

    const adjuntos = await Promise.all([
      downloadAttachment(data.archivo_escritura,                  `Escritura_${rut}`),
      downloadAttachment(data.archivo_cedula_rl,                  `Cedula_RL_${rut}`),
      downloadAttachment(data.archivo_erut,                       `ERUT_${rut}`),
      downloadAttachment(data.archivo_cedula_rl_cert,             `Cedula_RL_Certificado_${rut}`),
      downloadAttachment(data.contrato_transbank_plus_firmado,    `Contrato_Transbank_Plus_Firmado_${rut}.pdf`),
      downloadAttachment(data.contrato_transbank_oneclick_firmado,`Contrato_Transbank_OneClick_Firmado_${rut}.pdf`),
    ])

    const attachments = adjuntos.filter(Boolean)

    await resend.emails.send({
      from: 'Apio <noreply@apio.cl>',
      to: process.env.TRANSBANK_EXECUTIVE_EMAIL,
      subject: subject || `Solicitud Afiliación Transbank — ${data.razon_social}`,
      html: html || `<p>Solicitud de afiliación para ${data.razon_social}.</p>`,
      attachments,
    })

    await supabase.from('onboardings').update({ estado: 'firmado' }).eq('id', id)

    return { statusCode: 200, body: 'OK' }
  } catch (err) {
    console.error('send-transbank error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
