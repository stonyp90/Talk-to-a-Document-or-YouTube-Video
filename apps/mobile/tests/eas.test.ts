import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validateEnvironment, validateBuilds, verifyDownloads } from '../scripts/eas-contract';

const sha = 'a'.repeat(40);
const project = '12345678-1234-4234-8234-123456789abc';
const environment = { EXPO_OWNER: 'demo-team', EXPO_PROJECT_ID: project, EXPO_PUBLIC_API_URL: 'https://api.example.com' };
const builds = () => ['ANDROID', 'IOS'].map(platform => ({
  id: `${platform}-build`, platform, status: 'FINISHED', gitCommitHash: sha,
  project: { id: project }, artifacts: { applicationArchiveUrl: `https://expo.dev/artifacts/${platform}` },
}));

test('Given cloud or local configuration, enforce project linkage and cloud HTTPS without breaking local defaults', () => {
  const resolve = (env: Record<string, string>) => spawnSync(process.execPath,
    ['--import', 'tsx', '-e', 'console.log(JSON.stringify(require("./app.config.ts").default.expo))'], {
      cwd: new URL('..', import.meta.url), encoding: 'utf8',
      env: { ...process.env, EXPO_OWNER: '', EXPO_PROJECT_ID: '', EXPO_PUBLIC_API_URL: '', EAS_BUILD_PROFILE: '', ...env },
    });
  const local = resolve({});
  assert.equal(local.status, 0, local.stderr);
  assert.equal(JSON.parse(local.stdout).android.usesCleartextTraffic, true);
  const cloud = resolve({ ...environment, EAS_BUILD_PROFILE: 'preview' });
  assert.equal(cloud.status, 0, cloud.stderr);
  assert.equal(JSON.parse(cloud.stdout).extra.eas.projectId, project);
  assert.equal(JSON.parse(cloud.stdout).owner, environment.EXPO_OWNER);
  assert.notEqual(resolve({ EAS_BUILD_PROFILE: 'preview' }).status, 0);
  assert.notEqual(resolve({ ...environment, EAS_BUILD_PROFILE: 'preview', EXPO_PUBLIC_API_URL: 'http://localhost:3000' }).status, 0);
});

test('Given cloud configuration, require an owner, project UUID, and HTTPS API', () => {
  assert.doesNotThrow(() => validateEnvironment(environment));
  for (const key of Object.keys(environment)) {
    assert.throws(() => validateEnvironment({ ...environment, [key]: '' }));
  }
  for (const url of ['http://api.example.com', 'https://localhost', 'https://127.0.0.1', 'https://user:password@api.example.com']) {
    assert.throws(() => validateEnvironment({ ...environment, EXPO_PUBLIC_API_URL: url }));
  }
  assert.throws(() => validateEnvironment({ ...environment, EXPO_PROJECT_ID: 'not-a-project' }));
});

test('Given both completed builds of the tested commit, retain EAS artifact metadata', () => {
  assert.equal(validateBuilds(builds(), sha, project).length, 2);
});

test('Given queued, failed, canceled, missing, duplicate, wrong-project or stale builds, fail delivery', () => {
  for (const status of ['IN_QUEUE', 'IN_PROGRESS', 'ERRORED', 'CANCELED']) {
    assert.throws(() => validateBuilds(builds().map(build => ({ ...build, status })), sha, project));
  }
  assert.throws(() => validateBuilds([], sha, project));
  assert.throws(() => validateBuilds([builds()[0], builds()[0]], sha, project));
  assert.throws(() => validateBuilds(builds(), 'b'.repeat(40), project));
  assert.throws(() => validateBuilds(builds(), sha, 'wrong-project'));
  assert.throws(() => validateBuilds(builds().map(build => ({ ...build, artifacts: {} })), sha, project));
});

test('Given inaccessible or empty binaries, artifact verification fails', async () => {
  const records = validateBuilds(builds(), sha, project);
  await assert.rejects(verifyDownloads(records, async () => new Response(null, { status: 404 })));
  await assert.rejects(verifyDownloads(records, async () => new Response(null, { status: 200 })));
  await verifyDownloads(records, async () => new Response(new Uint8Array([1]), { status: 206 }));
});

test('Given successful same-repository main CI, build its exact SHA and wait for binaries', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/eas-build.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflows: \[CI\]/);
  assert.match(workflow, /conclusion == 'success'/);
  assert.match(workflow, /event == 'push'/);
  assert.match(workflow, /head_branch == 'main'/);
  assert.match(workflow, /head_repository.full_name == github.repository/);
  assert.match(workflow, /ref: \$\{\{ github.event.workflow_run.head_sha \}\}/);
  assert.match(workflow, /eas build --platform all --profile preview --non-interactive --wait --json/);
  assert.doesNotMatch(workflow, /--no-wait|--auto-submit|continue-on-error/);
  const profiles = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
  assert.equal(profiles.build.preview.android.buildType, 'apk');
  assert.equal(profiles.build.preview.ios.simulator, true);
  assert.equal(profiles.build.preview.environment, 'preview');
});
