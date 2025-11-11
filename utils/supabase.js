const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

if (!isSupabaseConfigured) {
	// Not throwing at import time to avoid crashing the server when running without Supabase.
	// Routes should handle missing config gracefully.
	// eslint-disable-next-line no-console
	console.warn('Supabase server credentials are not fully configured.');
}

const supabase = isSupabaseConfigured
	? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: { persistSession: false, autoRefreshToken: false },
	  })
	: null;

module.exports = { supabase, isSupabaseConfigured };


