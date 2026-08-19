import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/delete-user
 * Body: { targetUserId }
 * Header: Authorization: Bearer <caller access token>
 *
 * Removes the employee's login (auth.users) as well as their user_roles row.
 * Deleting the row alone leaves the account able to sign in, and the app
 * re-creates the row on the next sign-in — so the employee reappears as
 * "pending" instead of being gone.
 *
 * Only admins (admin / brand_owner / super_admin / owner) can call this.
 * Called same-origin from the CRM, so no CORS headers are needed.
 */
const ADMIN_ROLES = ['admin', 'brand_owner', 'super_admin', 'owner'];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { targetUserId } = req.body || {};
  if (!targetUserId) {
    return res.status(400).json({ error: 'targetUserId is required' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables');
    return res.status(500).json({ error: 'Server configuration error: service key missing' });
  }

  try {
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Who is calling?
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !caller) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // 2. Are they an admin? (service client bypasses RLS)
    const { data: callerRole } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle();

    if (!callerRole || !ADMIN_ROLES.includes(callerRole.role)) {
      return res.status(403).json({ error: 'Only admins can delete employees' });
    }

    // 3. Never let an admin delete themselves out of the system.
    if (caller.id === targetUserId) {
      return res.status(400).json({ error: 'مينفعش تحذف حسابك بنفسك' });
    }

    // 4. Drop the role row first so the employee disappears from the CRM even if
    //    the auth deletion needs a retry.
    const { error: roleError } = await serviceClient
      .from('user_roles')
      .delete()
      .eq('id', targetUserId);
    if (roleError) {
      console.error('Role row delete error:', roleError);
      return res.status(500).json({ error: roleError.message || 'Failed to delete employee record' });
    }

    // 5. Delete the login itself.
    const { error: authDeleteError } = await serviceClient.auth.admin.deleteUser(targetUserId);
    if (authDeleteError && !/not.?found/i.test(authDeleteError.message || '')) {
      console.error('Auth user delete error:', authDeleteError);
      return res.status(500).json({
        error: 'تم حذف الموظف من السيستم لكن فشل إلغاء حساب الدخول — حاول تاني.',
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}
