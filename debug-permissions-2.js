
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://supabase.dincouture.pk'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.uPWERzbv9FtmRpl0cBPDPox08YhjW_zTOXtwYNLWmuo'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debug() {
  console.log('--- DEBUG START ---')
  
  // Try to query role_permissions without filters
  const { data: perms, error } = await supabase
    .from('role_permissions')
    .select('*')
    .limit(5)
  
  if (error) {
    console.error(`Error fetching perms:`, error.message)
  } else {
    console.log(`role_permissions (all roles): Count: ${perms?.length || 0}`)
    console.log(`Data:`, JSON.stringify(perms, null, 2))
  }

  // Try to see what tables are there by querying some other table we expect
  const { data: users, error: uError } = await supabase
    .from('users')
    .select('id, email, role')
    .limit(5)
  
  if (uError) {
     console.log('Users table error:', uError.message)
  } else {
     console.log('Users found:', JSON.stringify(users, null, 2))
  }

  console.log('--- DEBUG END ---')
}

debug()
