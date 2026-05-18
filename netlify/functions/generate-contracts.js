import { createClient } from '@supabase/supabase-js'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import ExcelJS from 'exceljs'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export const handler = async (event) => {
  try {
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
  const tieneWebpayPlus = data.medios_pago?.includes('webpay_plus')
  const tieneOneClick = data.medios_pago?.includes('webpay_oneclick') || data.productos?.includes('pagos_recurrentes')
  const needsTransbank = tieneWebpayPlus || tieneOneClick

  if (needsTransbank) {
    // --- Excel ficha Transbank ---
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
        ...(tieneWebpayPlus ? [['Webpay Plus — Código Mall', '52981028']] : []),
        ...(tieneOneClick ? [
          ['Webpay OneClick — Código Mall', '42829258'],
          ['OneClick — Máx. transacciones/día', data.oneclick_max_transacciones || ''],
          ['OneClick — Monto máx. por transacción', data.oneclick_monto_max || ''],
          ['OneClick — Monto acumulado máx./día', data.oneclick_monto_acumulado || ''],
        ] : []),
      ]

      rows.forEach(([campo, valor]) => sheet.addRow({ campo, valor }))
      sheet.getRow(1).font = { bold: true }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }

      const excelBuffer = await workbook.xlsx.writeBuffer()
      const excelPath = `${id}/contratos/formulario_transbank.xlsx`
      await supabase.storage.from('onboarding-docs').upload(excelPath, excelBuffer, {
        upsert: true,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      updates.excel_transbank_path = excelPath
    } catch (err) {
      console.error('Error generando Excel Transbank:', err)
    }

    // --- Contratos Transbank (uno por producto) ---
    const { data: templateFile } = await supabase.storage
      .from('onboarding-docs')
      .download('templates/contrato_transbank.docx')

    if (templateFile) {
      const fechaHoy = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
      const baseVars = {
        razon_social: data.razon_social,
        rut_sociedad: data.rut_sociedad,
        nombre_rl: data.nombre_rl,
        rut_rl: data.rut_rl,
        direccion: data.direccion,
        comuna: data.comuna,
        banco: data.banco_label || '',
        numero_cuenta: data.numero_cuenta || '',
        fecha: fechaHoy,
      }

      const templateBuffer = Buffer.from(await templateFile.arrayBuffer())

      const generateTransbankContract = async (vars, filename, updateKey) => {
        const zip = new PizZip(templateBuffer)
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
        doc.render(vars)
        const out = doc.getZip().generate({ type: 'nodebuffer' })
        const path = `${id}/contratos/${filename}`
        await supabase.storage.from('onboarding-docs').upload(path, out, {
          upsert: true,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
        updates[updateKey] = path
      }

      if (tieneWebpayPlus) {
        await generateTransbankContract({
          ...baseVars,
          marca_plus: 'X',
          marca_oneclick: '',
          codigo_mall_plus: '52981028',
          codigo_mall_oneclick: '',
          oneclick_max_transacciones: '',
          oneclick_monto_max: '',
          oneclick_monto_acumulado: '',
        }, 'contrato_transbank_plus.docx', 'contrato_transbank_plus_path')
      }

      if (tieneOneClick) {
        await generateTransbankContract({
          ...baseVars,
          marca_plus: '',
          marca_oneclick: 'X',
          codigo_mall_plus: '',
          codigo_mall_oneclick: '42829258',
          oneclick_max_transacciones: data.oneclick_max_transacciones || '',
          oneclick_monto_max: data.oneclick_monto_max || '',
          oneclick_monto_acumulado: data.oneclick_monto_acumulado || '',
        }, 'contrato_transbank_oneclick.docx', 'contrato_transbank_oneclick_path')
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('onboardings').update({ ...updates, estado: 'contrato_generado' }).eq('id', id)
  }

  return { statusCode: 200, body: JSON.stringify(updates) }
  } catch (err) {
    console.error('generate-contracts error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
