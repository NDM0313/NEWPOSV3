#!/usr/bin/env node
// Generate anon and service_role JWTs signed with JWT_SECRET (for self-hosted Supabase).
// Usage: JWT_SECRET=your-secret node deploy/gen-jwt-keys.cjs
//   or:  node deploy/gen-jwt-keys.cjs your-jwt-secret
const crypto = require('crypto');
const secret = process.env.JWT_SECRET || process.argv[2] || '';
if (!secret) {
  console.error('Usage: JWT_SECRET=xxx node gen-jwt-keys.cjs   OR   node gen-jwt-keys.cjs <JWT_SECRET>');
  process.exit(1);
}
const header = { alg: 'HS256', typ: 'JWT' };
const iat = 1641769200;
const exp = 1799535600; // ~5 years
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (payload) => {
  const s = crypto.createHmac('sha256', secret).update(b64(header) + '.' + b64(payload)).digest('base64url');
  return b64(header) + '.' + b64(payload) + '.' + s;
};
const anon = sign({ role: 'anon', iss: 'supabase-demo', iat, exp });
const serviceRole = sign({ role: 'service_role', iss: 'supabase-demo', iat, exp });
console.log('ANON_KEY=' + anon);
console.log('SERVICE_ROLE_KEY=' + serviceRole);
