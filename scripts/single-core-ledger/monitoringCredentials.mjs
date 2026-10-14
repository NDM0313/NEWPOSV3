/**
 * Unified ledger production monitoring — credential resolution (no secrets logged).
 */

export const PROFILE_ORDER = ['din-china', 'din-bridal', 'din-couture'];

export const EMAIL_ENV_KEYS = {
  'din-china': 'QA_BROWSER_EMAIL_CHINA',
  'din-bridal': 'QA_BROWSER_EMAIL_BRIDAL',
  'din-couture': 'QA_BROWSER_EMAIL_COUTURE',
};

export const PASSWORD_ENV_KEYS = {
  'din-china': 'QA_BROWSER_PASSWORD_CHINA',
  'din-bridal': 'QA_BROWSER_PASSWORD_BRIDAL',
  'din-couture': 'QA_BROWSER_PASSWORD_COUTURE',
};

export const DEFAULT_EMAILS = {
  'din-china': 'din@yahoo.com',
  'din-bridal': 'ndm313@yahoo.com',
  'din-couture': 'zhd@dincouture.pk',
};

export function isGenericFallbackAllowed(env = process.env) {
  return env.ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK === 'true';
}

export function resolveProfileEmail(profileId, profilesRaw = null, env = process.env) {
  const envKey = EMAIL_ENV_KEYS[profileId];
  if (envKey && env[envKey]) {
    return { email: env[envKey], source: 'per-company' };
  }
  const fromProfile = profilesRaw?.profiles?.[profileId]?.login_email_default;
  if (fromProfile && fromProfile !== 'PENDING_OPERATOR') {
    return { email: fromProfile, source: 'profile-default' };
  }
  if (DEFAULT_EMAILS[profileId]) {
    return { email: DEFAULT_EMAILS[profileId], source: 'built-in-default' };
  }
  return { email: '', source: 'missing' };
}

export function resolveProfilePassword(profileId, env = process.env, { allowGenericFallback = false } = {}) {
  const envKey = PASSWORD_ENV_KEYS[profileId];
  if (envKey && env[envKey]) {
    return { ok: true, password: env[envKey], source: 'per-company' };
  }
  if (allowGenericFallback && env.QA_BROWSER_PASSWORD) {
    return { ok: true, password: env.QA_BROWSER_PASSWORD, source: 'generic-fallback-explicit' };
  }
  return {
    ok: false,
    missing: [envKey],
    message:
      `Missing ${envKey} for profile ${profileId}. ` +
      `Set per-company password or ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK=true with QA_BROWSER_PASSWORD.`,
  };
}

export function resolveThreeCompanyProfileCredentials(profileId, profilesRaw, env = process.env) {
  const { email, source: emailSource } = resolveProfileEmail(profileId, profilesRaw, env);
  const pwResult = resolveProfilePassword(profileId, env, {
    allowGenericFallback: isGenericFallbackAllowed(env),
  });
  if (!pwResult.ok) {
    return { ok: false, profileId, email, emailSource, ...pwResult };
  }
  return {
    ok: true,
    profileId,
    email,
    password: pwResult.password,
    emailSource,
    passwordSource: pwResult.source,
  };
}

export function validateThreeCompanyCredentials(profilesRaw, env = process.env) {
  const results = PROFILE_ORDER.map((id) => resolveThreeCompanyProfileCredentials(id, profilesRaw, env));
  const missing = results.filter((r) => !r.ok);
  if (missing.length === 0) return { ok: true, profiles: results };
  return {
    ok: false,
    missing: missing.map((m) => ({
      profileId: m.profileId,
      message: m.message,
      missing: m.missing,
    })),
    hint:
      'Set QA_BROWSER_PASSWORD_CHINA, QA_BROWSER_PASSWORD_BRIDAL, QA_BROWSER_PASSWORD_COUTURE ' +
      'or ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK=true with QA_BROWSER_PASSWORD.',
  };
}

/** Single MONITORING_PROFILE run — generic QA_BROWSER_* allowed. */
export function resolveSingleProfileMonitoringCredentials(profileId, env = process.env, profilesRaw = null) {
  const envEmailKey = EMAIL_ENV_KEYS[profileId];
  let email;
  let emailSource;
  if (envEmailKey && env[envEmailKey]) {
    email = env[envEmailKey];
    emailSource = 'per-company';
  } else if (env.QA_BROWSER_EMAIL) {
    email = env.QA_BROWSER_EMAIL;
    emailSource = 'generic-single-profile';
  } else {
    const resolved = resolveProfileEmail(profileId, profilesRaw, env);
    email = resolved.email;
    emailSource = resolved.source;
  }

  const envPwKey = PASSWORD_ENV_KEYS[profileId];
  let password;
  let passwordSource;
  if (envPwKey && env[envPwKey]) {
    password = env[envPwKey];
    passwordSource = 'per-company';
  } else if (env.QA_BROWSER_PASSWORD) {
    password = env.QA_BROWSER_PASSWORD;
    passwordSource = 'generic-single-profile';
  } else {
    return {
      ok: false,
      message: `Set ${envPwKey} or QA_BROWSER_PASSWORD for MONITORING_PROFILE=${profileId}`,
    };
  }

  return { ok: true, email, password, emailSource, passwordSource };
}

export function formatCredentialSourceLog(creds) {
  return `email-source=${creds.emailSource} password-source=${creds.passwordSource}`;
}

export function goldenPartyCredentialBindingHint(profileId, goldenParty, email) {
  const envHint = EMAIL_ENV_KEYS[profileId] || 'QA_BROWSER_EMAIL_<company>';
  return (
    `Golden party "${goldenParty}" not found for profile ${profileId} (login ${email}). ` +
    `Likely wrong credential binding — logged-in user may belong to a different company. ` +
    `Set ${envHint} to a user bound to the target company. This is a credential issue, not an accounting regression.`
  );
}

export function redactSecrets(text, ...secrets) {
  let out = text || '';
  for (const secret of secrets.filter(Boolean)) {
    out = out.split(secret).join('***');
  }
  return out;
}

export function assertNoPasswordInText(text, env = process.env) {
  const secrets = [
    env.QA_BROWSER_PASSWORD,
    env.QA_BROWSER_PASSWORD_CHINA,
    env.QA_BROWSER_PASSWORD_BRIDAL,
    env.QA_BROWSER_PASSWORD_COUTURE,
  ].filter(Boolean);
  for (const s of secrets) {
    if (text.includes(s)) return false;
  }
  return true;
}
