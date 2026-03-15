import { auditLaunchReadiness } from '../netlify/functions/_lib/launch-audit.js';

const result = auditLaunchReadiness(process.env);

console.log(`TraceWorks launch audit: ${result.ok ? 'PASS' : 'BLOCKED'}`);
console.log(`Blocking issues: ${result.blockingCount}`);
console.log(`Warnings: ${result.warningCount}`);
console.log('');

for (const check of result.checks) {
  const status = check.status.toUpperCase().padEnd(4, ' ');
  const severity = check.severity.toUpperCase().padEnd(8, ' ');
  console.log(`[${status}] [${severity}] ${check.label}`);
  console.log(`  ${check.detail}`);
  if (check.action) console.log(`  Action: ${check.action}`);
}

console.log('');
console.log('Manual verification still required:');
for (const item of result.manualActions) {
  console.log(`- ${item}`);
}

if (!result.ok) {
  process.exitCode = 1;
}
