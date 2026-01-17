import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xnpevheuniybnadyfjut.supabase.co'
const supabaseKey = 'sb_publishable_GL2zL4cEDTCOpv6VP9gFFA_G0SLU...' // yahan apni key daalein
const supabase = createClient(supabaseUrl, supabaseKey)

async function testKey() {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error('❌ API Key test failed:', error.message)
  } else {
    console.log('✅ API Key valid hai:', data)
  }
}

testKey()