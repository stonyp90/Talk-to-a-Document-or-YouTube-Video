#!/usr/bin/env node
// report.mjs — Generate quality report for the current branch
import { execSync, execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const BRANCH = execSync('git branch --show-current').toString().trim();
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_DIR = join(REPO_ROOT, '.qoder', 'reports');
const REPORT_FILE = join(REPORT_DIR, `quality-${BRANCH}-${TIMESTAMP}.md`);

mkdirSync(REPORT_DIR, { recursive: true });

function run(label, cmd) {
  const start = Date.now();
  try {
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'] });
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    return { label, status: 'PASS', duration, output: output.trim().slice(-500) };
  } catch (err) {
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    return { label, status: 'FAIL', duration, output: (err.stderr || err.stdout || '').toString().trim().slice(-500) };
  }
}

function countFiles(pattern, dir = '.') {
  try {
    const output = execFileSync('find', [dir, '-name', pattern, '-not', '-path', '*/node_modules/*'], { encoding: 'utf-8' });
    return output.split('\n').filter(Boolean).length;
  } catch { return 0; }
}

console.log(`Generating quality report for branch: ${BRANCH}`);

const checks = [
  run('Lint', 'npm run lint 2>&1'),
  run('TypeCheck', 'npm run typecheck 2>&1'),
  run('Unit tests', 'npm test 2>&1'),
  run('Secret scan', 'npm run security:secrets 2>&1'),
];

// Count test files
const unitTestFiles = countFiles('*.test.ts') + countFiles('*.test.tsx');
const e2eSpecs = countFiles('*.spec.ts');
const bddSteps = countFiles('*.ts', join(REPO_ROOT, 'tests', 'bdd'));

// Git stats
let commitCount = '0';
try {
  commitCount = execFileSync('git', ['rev-list', '--count', `main..${BRANCH}`], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
} catch { /* ignore */ }
let changedFiles = '0';
try {
  changedFiles = execFileSync('git', ['diff', '--name-only', 'main'], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim().split('\n').filter(Boolean).length.toString();
} catch { /* ignore */ }

// Proof artifacts
let proofCount = 0;
let staleCount = 0;
const artifactDir = join(REPO_ROOT, '.qoder', 'artifacts');
if (existsSync(artifactDir)) {
  try {
    const proofOutput = execFileSync('find', [artifactDir, '-name', '*.proof', '!', '-name', '*.stale'], { encoding: 'utf-8' });
    proofCount = proofOutput.split('\n').filter(Boolean).length;
    const staleOutput = execFileSync('find', [artifactDir, '-name', '*.stale'], { encoding: 'utf-8' });
    staleCount = staleOutput.split('\n').filter(Boolean).length;
  } catch { /* ignore */ }
}

const allPassed = checks.every(c => c.status === 'PASS');
const overallStatus = allPassed ? 'PASS' : 'FAIL';

const report = `# Quality Report

| Field | Value |
|---|---|
| Branch | \`${BRANCH}\` |
| Generated | ${new Date().toISOString()} |
| Status | **${overallStatus}** |
| Commits ahead of main | ${commitCount} |
| Changed files vs main | ${changedFiles} |

## Checks

| Check | Status | Duration |
|---|---|---|
${checks.map(c => `| ${c.label} | ${c.status} | ${c.duration}s |`).join('\n')}

## Test counts

| Suite | Count | Threshold | Status |
|---|---|---|---|
| Unit test files | ${unitTestFiles} | >= 30 | ${unitTestFiles >= 30 ? 'PASS' : 'FAIL'} |
| E2E spec files | ${e2eSpecs} | >= 2 | ${e2eSpecs >= 2 ? 'PASS' : 'FAIL'} |
| BDD step files | ${bddSteps} | >= 6 | ${bddSteps >= 6 ? 'PASS' : 'FAIL'} |

## Proof artifacts

| Metric | Value |
|---|---|
| Valid proofs | ${proofCount} |
| Stale proofs | ${staleCount} |

## Summary

${allPassed ? 'All checks passed.' : 'Some checks failed — review above.'}
${staleCount > 0 ? `\n**Warning:** ${staleCount} stale proof(s) detected. Re-run tests on current branch.` : ''}
${proofCount === 0 ? '\n**Warning:** No valid proofs. Feature cannot be merged.' : ''}
`;

writeFileSync(REPORT_FILE, report, 'utf-8');
console.log(`Report written to: ${REPORT_FILE}`);
console.log(`Overall: ${overallStatus}`);

// Also write a latest symlink/copy for easy access
const latestFile = join(REPORT_DIR, `quality-${BRANCH}-latest.md`);
writeFileSync(latestFile, report, 'utf-8');

process.exit(allPassed ? 0 : 1);
