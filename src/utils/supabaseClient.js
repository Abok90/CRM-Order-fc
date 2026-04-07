import { createClient } from '@supabase/supabase-js';

// Note: Ensure RLS is active on all tables in the Supabase Dashboard
const SUPABASE_URL = 'https://tdprtlvogzfzfckpvkpa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkcHJ0bHZvZ3pmemZja3B2a3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTUwMTcsImV4cCI6MjA4ODQ3MTAxN30.0TrcH65HQO5gboqsNfadSCGZQ95anY_0Bz97db5dPBg';

// Singleton instance
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
