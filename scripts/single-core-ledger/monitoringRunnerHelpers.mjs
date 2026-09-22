export function buildTimestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function parseMonitoringOutput(text) {
  const lines = text.split('\n').filter(Boolean);
  const checks = [];
  let phaseResult = null;
  for (const line of lines) {
    const m = line.match(/^\[(PASS|FAIL|WAIVED)\] (.+?)(?: — (.+))?$/);
    if (m) checks.push({ result: m[1], check: m[2], notes: m[3] || '' });
    const phase = line.match(/Phase 2\.16 monitoring: (PASS|FAIL)/);
    if (phase) phaseResult = phase[1];
  }
  return { checks, phaseResult };
}
