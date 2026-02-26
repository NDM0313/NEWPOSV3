// Supabase Edge Function: user-admin-actions
// Admin-only: send password reset email, set new password

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const adminSecret = Deno.env.get('ADMIN_SECRET');
    if (adminSecret && req.headers.get('X-Admin-Secret') !== adminSecret) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });

    const { data: { user: caller } } = await supabaseAnon.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: callerProfile } = await supabaseAdmin.from('users').select('role').or(`id.eq.${caller.id},auth_user_id.eq.${caller.id}`).limit(1).maybeSingle();
    if ((callerProfile as any)?.role !== 'admin') {
      return new Response(JSON.stringify({ success: false, error: 'Only admin can perform this action' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { action, user_id, email, new_password } = body;

    const targetEmail = email?.trim().toLowerCase();
    let authUserId: string | null = null;

    if (user_id) {
      const { data: u } = await supabaseAdmin.from('users').select('auth_user_id, email').eq('id', user_id).maybeSingle();
      if (u) {
        authUserId = (u as any).auth_user_id || null;
        if (!authUserId && (u as any).email) targetEmail ||= (u as any).email.trim().toLowerCase();
      }
    }
    if (!authUserId && targetEmail) {
      const { data: au } = await supabaseAdmin.auth.admin.listUsers();
      const match = au?.users?.find((u) => u.email?.toLowerCase() === targetEmail);
      authUserId = match?.id || null;
    }

    if (action === 'send_reset_email') {
      if (!targetEmail) return new Response(JSON.stringify({ success: false, error: 'email or user_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(targetEmail);
      if (error) return new Response(JSON.stringify({ success: false, error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'reset_password') {
      if (!authUserId && !targetEmail) return new Response(JSON.stringify({ success: false, error: 'user_id or email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!new_password || new_password.length < 6) return new Response(JSON.stringify({ success: false, error: 'new_password required (min 6 chars)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      let uid = authUserId;
      if (!uid && targetEmail) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        uid = list?.users?.find((u) => u.email?.toLowerCase() === targetEmail)?.id || null;
      }
      if (!uid) return new Response(JSON.stringify({ success: false, error: 'User not linked to Auth. Invite them first.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, { password: new_password });
      if (error) return new Response(JSON.stringify({ success: false, error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid action. Use send_reset_email or reset_password' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
