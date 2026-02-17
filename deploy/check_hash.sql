SELECT id, email, substring(encrypted_password,1,35) as pass_prefix
FROM auth.users WHERE email = 'demo@dincollection.com';
