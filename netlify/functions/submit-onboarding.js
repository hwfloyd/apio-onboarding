import { createClient } from '@supabase/supabase-js'

// Usa service key — bypassa RLS completamente
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const body = JSON.parse(event.body)

  const { data, error } = await supabase
    .from('onboardings')
    .insert(body)
    .select()
    .single()

  if (error) {
    console.error('Insert error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }

  // Disparar notificación por correo
  try {
    await fetch(`${process.env.SITE_URL}/.netlify/functions/notify-onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: data.id }),
    })
  } catch (e) {
    console.error('Error enviando notificación:', e)
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ id: data.id }),
  }
}
