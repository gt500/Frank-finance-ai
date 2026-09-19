// Shared CORS headers for edge functions called directly from the browser
// (chat-message, extract-document, delete-account, paygate-initiate).
// paygate-notify/paygate-charge are server-to-server only and don't need this.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
