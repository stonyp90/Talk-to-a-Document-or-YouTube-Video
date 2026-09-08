import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, lstatSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
function run(command, args, capture = false) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`${command} failed; security check did not pass.`);
  return result.stdout;
}
const snapshot = mkdtempSync(join(tmpdir(), 'ursly-secret-scan-'));
try {
  // History remains unfiltered, including files that were later removed/ignored.
  run('gitleaks', ['git', root, '--log-opts=--all', '--config', join(root, '.gitleaks.toml'), '--redact=100', '--no-banner']);
  const names = new Set(run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], true).split('\0').filter(Boolean));
  let copied = 0;
  for (const name of names) {
    const path = join(root, name);
    let stat;
    try { stat = lstatSync(path); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (stat.isSymbolicLink()) throw new Error(`Review symlink before publishing: ${name}`);
    if (!stat.isFile()) continue;
    if (/(^|\/)(\.aws|\.next|\.terraform|node_modules|Pods)(\/|$)|(^|\/)\.env($|\.(?!example$))|\.(pem|key|p12|pfx|p8|jks|keystore|mobileprovision|tfstate(?:\..*)?|tfplan|tfvars(?:\.json)?)$|(^|\/)(credentials|secrets)\.json$/.test(name)) {
      throw new Error(`Sensitive/generated file is included in publication candidates: ${name}`);
    }
    const target = join(snapshot, name);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(path, target);
    copied++;
  }
  run('gitleaks', ['dir', snapshot, '--config', join(root, '.gitleaks.toml'), '--redact=100', '--no-banner']);
  console.log(`Secret scan passed: Git history and ${copied} current publication candidates.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { rmSync(snapshot, { recursive: true, force: true }); }
