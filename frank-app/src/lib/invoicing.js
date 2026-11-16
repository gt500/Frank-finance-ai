// One copy of the invoicing rules: it lives with the edge functions (they need it to build PDFs and statements)
// and the app re-exports it, so the browser and the server can never disagree about money.
export * from '../../supabase/functions/_shared/invoicing.js'
