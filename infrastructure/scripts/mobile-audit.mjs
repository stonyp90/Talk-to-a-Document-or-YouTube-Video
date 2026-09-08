import { spawnSync } from 'node:child_process';
import { writeFileSync, appendFileSync } from 'node:fs';
const audit = spawnSync('npm', ['audit', '--json'], { cwd: 'apps/mobile', encoding: 'utf8' });
if (audit.error) throw audit.error;
const report = JSON.parse(audit.stdout);
writeFileSync('infrastructure/mobile-audit.json', JSON.stringify(report, null, 2));
if (report.error || !report.metadata?.vulnerabilities) throw new Error('Mobile dependency audit could not complete');
const counts = report.metadata.vulnerabilities;
const message = `Mobile dependency audit: ${counts.total} findings (${counts.moderate} moderate, ${counts.high} high, ${counts.critical} critical). This is not a clean security audit; Expo/Metro remediation remains a release requirement.`;
console.log(message);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
if (counts.total > 0) console.log(`::warning::${message}`);
// Explicit demo policy: report existing moderate/high findings; critical findings fail CI.
if (counts.critical > 0) process.exitCode = 1;
