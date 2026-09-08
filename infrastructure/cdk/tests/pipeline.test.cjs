const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const workflow = name => readFileSync(resolve(__dirname, '../../../.github/workflows', name), 'utf8');
test('deploy checks out the CI head SHA and never moving main', () => {
  const deploy = workflow('deploy.yml');
  assert.match(deploy, /ref: \$\{\{ github.event.workflow_run.head_sha \}\}/);
  assert.match(deploy, /git rev-parse HEAD/);
  assert.doesNotMatch(deploy, /ref: main|\$\{?GITHUB_SHA/);
  assert.match(deploy, /imageTag="\$TESTED_SHA"/);
  assert.match(deploy, /workflow_run.event == 'push'/);
  assert.match(deploy, /head_repository.full_name == github.repository/);
});
test('CI has mandatory checks, starts service before BDD, excludes only external gates', () => {
  const ci = workflow('ci.yml');
  for (const check of ['npm run lint', 'npm run typecheck', 'npm test', 'npm run test:gherkin', 'npm run test:e2e', 'npm run build']) assert.ok(ci.includes(check));
  assert.ok(ci.indexOf('docker compose up') < ci.indexOf('npm run test:gherkin'));
  assert.ok(ci.indexOf('check-client-secrets.mjs') < ci.indexOf('npm run test:gherkin'));
  assert.match(ci, /--tags 'not @external'/);
  assert.doesNotMatch(ci, /continue-on-error|hashFiles|if-present|\|\| true/);
  assert.match(ci, /test "\$APPLICATION" = success && test "\$CONTAINERS" = success/);
});
test('post-deploy smoke is mandatory and images are Lambda-compatible', () => {
  const deploy = workflow('deploy.yml');
  assert.match(deploy, /Mandatory deployment smoke tests/);
  assert.doesNotMatch(deploy, /DEPLOYMENT_HEALTHCHECK_URL|continue-on-error/);
  assert.equal((deploy.match(/--platform linux\/amd64 --provenance=false --sbom=false/g) ?? []).length, 2);
});
