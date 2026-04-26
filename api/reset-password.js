import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/reset-password
 * Body: { targetUserId, newPassword, callerToken }
 *
 * Uses the service_role key to update another user's password.
 * Only admins (admin / brand_owner / super_admin / owner) can call this.
 */
export default async function handler(req, res) {
  // — CORS preflight —
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const { targetUserId, newPassword } = req.body || {};

  if (!targetUserId || !newPassword) {
    return res.status(400).json({ error: 'targetUserId and newPassword are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // — Verify the caller is an admin —
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables');
    return res.status(500).json({ error: 'Server configuration error: service key missing' });
  }

  try {
    // Use service_role client for all server-side operations (bypasses RLS)
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Verify caller identity using their JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !caller) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // 2. Check caller is admin in user_roles table (service client bypasses RLS)
    const { data: callerRole } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle();

    const ADMIN_ROLES = ['admin', 'brand_owner', 'super_admin', 'owner'];
    if (!callerRole || !ADMIN_ROLES.includes(callerRole.role)) {
      return res.status(403).json({ error: 'Only admins can reset passwords' });
    }

    // 3. Prevent admin from resetting their own password through this endpoint
    if (caller.id === targetUserId) {
      return res.status(400).json({ error: 'Use Settings page to change your own password' });
    }

    // 4. Update the target user's password
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return res.status(500).json({ error: updateError.message || 'Failed to update password' });
    }

    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}
