#!/usr/bin/env node
// Generate Supabase anon JWT signed with the given secret (for self-hosted Kong)
const crypto = require('crypto');
const secret = process.env.JWT_SECRET || process.argv[2] || 'dincouture-jwt-secret-32-chars-minimum-required-here';
const header = { alg: 'HS256', typ: 'JWT' };
const payload = {
  role: 'anon',
  iss: 'supabase-demo',
  iat: 1641769200,
  exp: 1799535600
};
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sig = crypto.createHmac('sha256', secret).update(b64(header) + '.' + b64(payload)).digest('base64url');
console.log(b64(header) + '.' + b64(payload) + '.' + sig);
