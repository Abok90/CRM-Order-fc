import { createClient } from '@supabase/supabase-js';

// Values are injected at build time from Vercel environment variables.
// Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Vercel dashboard.
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Singleton instance — Ensure RLS is active on all tables in Supabase Dashboard
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
