// CORS for edge functions called directly from the browser. paygate-notify/paygate-charge are
// server-to-server only and don't use this.
//
// Only our own app may call these from a browser: production (APP_URL), Vercel previews of this
// project, and local dev. Extra origins: ALLOWED_ORIGINS (comma-separated) env var.
export const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Vary': 'Origin',
}

const EXACT = new Set([
  originOf(Deno.env.get('APP_URL')),
  // Production domains of the Vercel project "zeeder-finance-os".
  'https://zeederfinanceos.com',
  'https://www.zeederfinanceos.com',
  'https://zeeder-finance-os.vercel.app',
  'http://localhost:3000',
  ...(Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()),
].filter(Boolean))
// Preview/deployment URLs under our team scope. The team suffix matters: anyone could create a
// different project named "zeeder-finance-<x>", but not under -gt500s-projects.
const VERCEL_PREVIEW = /^https:\/\/zeeder-finance-[a-z0-9-]+-gt500s-projects\.vercel\.app$/

function originOf(url: string | undefined) {
  try { return url ? new URL(url).origin : '' } catch { return '' }
}

export function isAllowedOrigin(origin: string | null) {
  return !!origin && (EXACT.has(origin) || VERCEL_PREVIEW.test(origin))
}

/** Wrap a Deno.serve handler: answers preflight and echoes back only an allowed Origin. */
export function withCors(handler: (req: Request) => Promise<Response> | Response) {
  return async (req: Request) => {
    const origin = req.headers.get('Origin')
    let res: Response
    try {
      res = req.method === 'OPTIONS' ? new Response(null, { headers: corsHeaders }) : await handler(req)
    } catch (err) {
      // An uncaught throw would otherwise reach the browser as a confusing CORS error.
      console.error('Unhandled error:', err)
      res = new Response(JSON.stringify({ error: 'Something went wrong — please try again.' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }
    const headers = new Headers(res.headers)
    if (isAllowedOrigin(origin)) headers.set('Access-Control-Allow-Origin', origin!)
    else headers.delete('Access-Control-Allow-Origin')
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  }
}
