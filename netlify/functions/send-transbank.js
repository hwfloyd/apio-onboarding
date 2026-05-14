import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)

export const handler = async (event) => {
  const { id } = JSON.parse(event.body)

  const { data, error } = await supabase.from('onboardings').select('*').eq('id', id).single()
  if (error) return { statusCode: 500, body: 'Error fetching onboarding' }

  const contratoPath = data.contrato_transbank_firmado
  if (!contratoPath) {
    return { statusCode: 400, body: 'Contrato Transbank firmado no encontrado' }
  }

  // Descargar contrato firmado desde storage
  const { data: fileData, error: fileError } = await supabase.storage
    .from('onboarding-docs')
    .download(contratoPath)

  if (fileError) return { statusCode: 500, body: 'Error descargando contrato' }

  const buffer = Buffer.from(await fileData.arrayBuffer())

  // Adjuntar Excel de Transbank si existe
  const attachments = [
    {
      filename: `Contrato_Transbank_${data.rut_sociedad}.pdf`,
      content: buffer.toString('base64'),
    },
  ]

  if (data.excel_transbank_path) {
    const { data: excelData } = await supabase.storage.from('onboarding-docs').download(data.excel_transbank_path)
    if (excelData) {
      const excelBuffer = Buffer.from(await excelData.arrayBuffer())
      attachments.push({
        filename: `Formulario_Transbank_${data.rut_sociedad}.xlsx`,
        content: excelBuffer.toString('base64'),
      })
    }
  }

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
      <h2>Solicitud de Afiliación Transbank</h2>
      <p>Estimado ejecutivo,</p>
      <p>Se adjunta la solicitud de afiliación a Transbank para el siguiente cliente:</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:6px 12px;font-weight:500;background:#f9fafb;border:1px solid #e5e7eb">Razón Social</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${data.razon_social}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:500;background:#f9fafb;border:1px solid #e5e7eb">RUT</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${data.rut_sociedad}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:500;background:#f9fafb;border:1px solid #e5e7eb">Servicios</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${(data.medios_pago || []).filter(m => m.includes('webpay')).join(', ')}</td></tr>
      </table>
      <p>Adjunto encontrarás el contrato firmado y el formulario de afiliación.</p>
      <p>Saludos,<br>Equipo Apio</p>
    </div>
  `

  await resend.emails.send({
    from: 'Apio <noreply@apio.cl>',
    to: process.env.TRANSBANK_EXECUTIVE_EMAIL,
    subject: `Solicitud Afiliación Transbank — ${data.razon_social}`,
    html,
    attachments,
  })

  await supabase.from('onboardings').update({ estado: 'firmado' }).eq('id', id)

  return { statusCode: 200, body: 'OK' }
}
