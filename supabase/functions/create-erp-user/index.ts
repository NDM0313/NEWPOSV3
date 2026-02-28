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
  temporary_password?: string;
  send_invite_email?: boolean;
  /** Assign branch access (auth_user_id only). Validated against company_id. */
  branch_ids?: string[];
  /** Assign account access (auth_user_id only). Validated against company_id. */
  account_ids?: string[];
  /** Default branch for user_branches.is_default */
  default_branch_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    const hasJwt = authHeader?.startsWith('Bearer ');

    // When Bearer JWT present, use it. Otherwise require X-Admin-Secret if ADMIN_SECRET is set.
    const adminSecret = Deno.env.get('ADMIN_SECRET');
    const hasValidAdminSecret = !!adminSecret && req.headers.get('X-Admin-Secret') === adminSecret;
    if (!hasJwt && !hasValidAdminSecret) {
      const msg = !authHeader ? 'Missing authorization' : 'Invalid or expired token';
      return new Response(
        JSON.stringify({ success: false, error: msg }),
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
    const { email, full_name, role: newRole, phone, is_salesman, is_active, company_id, temporary_password, send_invite_email, branch_ids, account_ids, default_branch_id } = body;

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

    const publicUserId = crypto.randomUUID();
    const { error: insertErr } = await supabaseAdmin.from('users').insert({
      id: publicUserId,
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

    let assignedBranchesCount = 0;
    let assignedAccountsCount = 0;

    if (authUserId && (branch_ids?.length || account_ids?.length)) {
      const branchIds = Array.isArray(branch_ids) ? branch_ids.filter(Boolean) : [];
      const accountIds = Array.isArray(account_ids) ? account_ids.filter(Boolean) : [];
      const defaultBranch = default_branch_id || branchIds[0];

      if (branchIds.length > 0) {
        const { data: validBranches } = await supabaseAdmin
          .from('branches')
          .select('id')
          .eq('company_id', company_id)
          .in('id', branchIds);
        const ids = (validBranches || []).map((b: { id: string }) => b.id);
        await supabaseAdmin.from('user_branches').delete().eq('user_id', authUserId);
        if (ids.length > 0) {
          const rows = ids.map((bid: string) => ({
            user_id: authUserId,
            branch_id: bid,
            is_default: bid === defaultBranch,
          }));
          const { error: eb } = await supabaseAdmin.from('user_branches').insert(rows);
          if (!eb) assignedBranchesCount = ids.length;
        }
      }

      if (accountIds.length > 0) {
        const { data: validAccounts } = await supabaseAdmin
          .from('accounts')
          .select('id')
          .eq('company_id', company_id)
          .in('id', accountIds);
        const ids = (validAccounts || []).map((a: { id: string }) => a.id);
        await supabaseAdmin.from('user_account_access').delete().eq('user_id', authUserId);
        if (ids.length > 0) {
          const rows = ids.map((aid: string) => ({ user_id: authUserId, account_id: aid }));
          const { error: ea } = await supabaseAdmin.from('user_account_access').insert(rows);
          if (!ea) assignedAccountsCount = ids.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: publicUserId,
        auth_user_id: authUserId,
        created: true,
        assignedBranchesCount,
        assignedAccountsCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
