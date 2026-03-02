
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://supabase.dincouture.pk'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.uPWERzbv9FtmRpl0cBPDPox08YhjW_zTOXtwYNLWmuo'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debug() {
  console.log('--- DEBUG START ---')
  console.log('Supabase URL:', supabaseUrl)
  
  // 1. Check role_permissions
  const roles = ['owner', 'admin', 'manager', 'user']
  for (const role of roles) {
    const { data: perms, error } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('role', role)
    
    if (error) {
      console.error(`Error fetching perms for role ${role}:`, error.message)
    } else {
      console.log(`Role: ${role}, Count: ${perms?.length || 0}`)
      if (perms && perms.length > 0) {
        console.log(`First 3 perms for ${role}:`, JSON.stringify(perms.slice(0, 3), null, 2))
      }
    }
  }

  // 2. Try to find a user in profiles if it exists
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('id, role, company_id')
    .limit(5)
  
  if (pError) {
    console.log('Profiles table check error:', pError.message)
  } else {
    console.log('Profiles found:', JSON.stringify(profiles, null, 2))
  }

  // 3. Check user_branches
  if (profiles && profiles.length > 0) {
    for (const profile of profiles) {
      const { data: branches, error: bError } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', profile.id)
      
      console.log(`User ID: ${profile.id}, Role: ${profile.role}, Branches:`, (branches || []).map(b => b.branch_id), bError?.message || '')
    }
  }

  console.log('--- DEBUG END ---')
}

debug()
