import { createClient } from '@supabase/supabase-js';

// Prefer build-time env vars (set in Vercel dashboard + .env locally).
// Fallback values keep the app working before env vars are configured.
// To rotate the anon key: update VITE_SUPABASE_ANON_KEY in Vercel + .env then remove the fallback strings.
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || 'https://tdprtlvogzfzfckpvkpa.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkcHJ0bHZvZ3pmemZja3B2a3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTUwMTcsImV4cCI6MjA4ODQ3MTAxN30.0TrcH65HQO5gboqsNfadSCGZQ95anY_0Bz97db5dPBg';

// Singleton instance — Ensure RLS is active on all tables in Supabase Dashboard
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
