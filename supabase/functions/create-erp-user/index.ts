// Supabase Edge Function: create-erp-user
// Creates auth user + ERP profile. Requires admin JWT. Uses service role for auth.admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
};

interface CreateErpUserRequest {
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  is_salesman?: boolean;
  is_active?: boolean;
  company_id: string;
  /** Temporary password. If omitted, sends invite email instead. */
  temporary_password?: string;
  /** If true, send invite email instead of using temporary_password */
  send_invite_email?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    console.log('[create-erp-user] Authorization:', authHeader ? `${authHeader.slice(0, 30)}...` : 'MISSING');

    const adminSecret = Deno.env.get('ADMIN_SECRET');
    if (adminSecret && req.headers.get('X-Admin-Secret') !== adminSecret) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user: caller } } = await supabaseAnon.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('users')
      .select('role, company_id')
      .or(`id.eq.${caller.id},auth_user_id.eq.${caller.id}`)
      .limit(1)
      .maybeSingle();

    if (!callerProfile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Caller not found in users table' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const role = (callerProfile as any)?.role;
    if (role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Only admin can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreateErpUserRequest = await req.json();
    const { email, full_name, role: newRole, phone, is_salesman, is_active, company_id, temporary_password, send_invite_email } = body;

    if (!email?.trim() || !full_name?.trim() || !company_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'email, full_name, company_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailTrim = email.trim().toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('company_id', company_id)
      .ilike('email', emailTrim)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: false, error: `User with email "${emailTrim}" already exists` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let authUserId: string;

    if (send_invite_email) {
      const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(emailTrim, {
        data: { full_name: full_name.trim() },
      });
      if (inviteErr) {
        return new Response(
          JSON.stringify({ success: false, error: inviteErr.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      authUserId = inviteData.user!.id;
    } else if (temporary_password && temporary_password.length >= 6) {
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: emailTrim,
        password: temporary_password,
        email_confirm: true,
        user_metadata: { full_name: full_name.trim() },
      });
      if (createErr) {
        return new Response(
          JSON.stringify({ success: false, error: createErr.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      authUserId = createData.user!.id;
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Provide temporary_password (min 6 chars) or send_invite_email: true' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: insertErr } = await supabaseAdmin.from('users').insert({
      id: crypto.randomUUID(),
      auth_user_id: authUserId,
      company_id,
      email: emailTrim,
      full_name: full_name.trim(),
      role: newRole || 'staff',
      phone: phone?.trim() || null,
      is_active: is_active ?? true,
      can_be_assigned_as_salesman: is_salesman ?? false,
    });

    if (insertErr) {
      return new Response(
        JSON.stringify({ success: false, error: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, auth_user_id: authUserId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
