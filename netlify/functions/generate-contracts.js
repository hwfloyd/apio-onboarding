import { createClient } from '@supabase/supabase-js'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import ExcelJS from 'exceljs'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export const handler = async (event) => {
  const { id } = JSON.parse(event.body)

  const { data, error } = await supabase.from('onboardings').select('*').eq('id', id).single()
  if (error) return { statusCode: 500, body: 'Error fetching onboarding' }

  const updates = {}

  // --- Generar contrato prestación de servicios ---
  try {
    const { data: templateFile } = await supabase.storage
      .from('onboarding-docs')
      .download('templates/contrato_prestacion.docx')

    if (templateFile) {
      const buffer = Buffer.from(await templateFile.arrayBuffer())
      const zip = new PizZip(buffer)
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

      const fechaHoy = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })

      doc.render({
        razon_social: data.razon_social,
        nombre_fantasia: data.nombre_fantasia || data.razon_social,
        rut_sociedad: data.rut_sociedad,
        direccion: data.direccion,
        oficina: data.oficina || '',
        comuna: data.comuna,
        region: data.region,
        nombre_rl: data.nombre_rl,
        rut_rl: data.rut_rl,
        telefono_rl: data.telefono_rl,
        email_rl: data.email_rl,
        actividad_economica: data.actividad_economica || '',
        productos: (data.productos || []).join(', '),
        fecha: fechaHoy,
      })

      const out = doc.getZip().generate({ type: 'nodebuffer' })
      const path = `${id}/contratos/prestacion_servicios.docx`
      await supabase.storage.from('onboarding-docs').upload(path, out, { upsert: true, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      updates.contrato_prestacion_path = path
    }
  } catch (err) {
    console.error('Error generando contrato prestación:', err)
  }

  // --- Generar Excel Transbank si aplica ---
  const needsTransbank = data.medios_pago?.includes('webpay_plus') || data.medios_pago?.includes('webpay_oneclick') || data.productos?.includes('pagos_recurrentes')

  if (needsTransbank) {
    try {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Formulario Afiliación')

      sheet.columns = [
        { header: 'Campo', key: 'campo', width: 40 },
        { header: 'Valor', key: 'valor', width: 50 },
      ]

      const rows = [
        ['Razón Social', data.razon_social],
        ['Nombre de Fantasía', data.nombre_fantasia || ''],
        ['RUT Empresa', data.rut_sociedad],
        ['Dirección', data.direccion],
        ['Oficina', data.oficina || ''],
        ['Comuna', data.comuna],
        ['Región', data.region],
        ['Actividad Económica', data.actividad_economica || ''],
        ['Nombre Representante Legal', data.nombre_rl],
        ['RUT Representante Legal', data.rut_rl],
        ['Teléfono Representante Legal', data.telefono_rl],
        ['Email Representante Legal', data.email_rl],
        ['Banco', data.banco_label || ''],
        ['N° Cuenta', data.numero_cuenta || ''],
        ['RUT Titular Cuenta', data.rut_titular_es_sociedad ? data.rut_sociedad : (data.rut_titular_cuenta || '')],
        ['Servicios Solicitados', (data.medios_pago || []).filter(m => m.includes('webpay')).join(', ')],
        ['Máx. Transacciones OneClick/día', data.oneclick_max_transacciones || ''],
        ['Monto Máx. OneClick por transacción', data.oneclick_monto_max || ''],
        ['Monto Acumulado Máx. OneClick/día', data.oneclick_monto_acumulado || ''],
      ]

      rows.forEach(([campo, valor]) => sheet.addRow({ campo, valor }))

      // Estilos básicos
      sheet.getRow(1).font = { bold: true }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }

      const excelBuffer = await workbook.xlsx.writeBuffer()
      const path = `${id}/contratos/formulario_transbank.xlsx`
      await supabase.storage.from('onboarding-docs').upload(path, excelBuffer, {
        upsert: true,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      updates.excel_transbank_path = path
    } catch (err) {
      console.error('Error generando Excel Transbank:', err)
    }

    // Contrato Transbank desde plantilla
    try {
      const { data: templateFile } = await supabase.storage
        .from('onboarding-docs')
        .download('templates/contrato_transbank.docx')

      if (templateFile) {
        const buffer = Buffer.from(await templateFile.arrayBuffer())
        const zip = new PizZip(buffer)
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
        const fechaHoy = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })

        doc.render({
          razon_social: data.razon_social,
          rut_sociedad: data.rut_sociedad,
          nombre_rl: data.nombre_rl,
          rut_rl: data.rut_rl,
          direccion: data.direccion,
          comuna: data.comuna,
          banco: data.banco_label || '',
          numero_cuenta: data.numero_cuenta || '',
          servicios_webpay: (data.medios_pago || []).filter(m => m.includes('webpay')).join(', '),
          fecha: fechaHoy,
        })

        const out = doc.getZip().generate({ type: 'nodebuffer' })
        const path = `${id}/contratos/contrato_transbank.docx`
        await supabase.storage.from('onboarding-docs').upload(path, out, { upsert: true, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
        updates.contrato_transbank_path = path
      }
    } catch (err) {
      console.error('Error generando contrato Transbank:', err)
    }
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('onboardings').update({ ...updates, estado: 'contrato_generado' }).eq('id', id)
  }

  return { statusCode: 200, body: JSON.stringify(updates) }
}
