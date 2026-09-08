import assert from 'node:assert/strict';

export function validateEnvironment(env: Record<string, string | undefined>) {
  assert.match(env.EXPO_OWNER ?? '', /^[a-zA-Z0-9_-]+$/, 'EXPO_OWNER is required');
  assert.match(env.EXPO_PROJECT_ID ?? '', /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i, 'EXPO_PROJECT_ID must be an EAS project UUID');
  const url = new URL(env.EXPO_PUBLIC_API_URL ?? '');
  assert.equal(url.protocol, 'https:', 'Cloud builds require an HTTPS API');
  assert(!url.username && !url.password && !url.search && !url.hash, 'API URL cannot contain credentials, query or fragment');
  assert(!/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url.hostname), 'Cloud builds cannot use a loopback API');
}

type Build = {
  id: string;
  platform: string;
  status: string;
  gitCommitHash: string;
  project: { id: string };
  artifacts: { applicationArchiveUrl?: string; buildUrl?: string };
};

export function validateBuilds(input: unknown, sha: string, projectId: string): Build[] {
  assert.match(sha, /^[\da-f]{40}$/i, 'Expected tested commit SHA');
  assert(Array.isArray(input) && input.length === 2, 'Both native builds must be returned');
  const builds = input as Build[];
  assert.deepEqual(builds.map(build => build.platform).sort(), ['ANDROID', 'IOS']);
  for (const build of builds) {
    assert(build.id, 'Build ID missing');
    assert.equal(build.status, 'FINISHED', 'Build has not finished successfully');
    assert.equal(build.gitCommitHash, sha, 'Build does not match tested commit');
    assert.equal(build.project?.id, projectId, 'Build belongs to another EAS project');
    const artifact = new URL(build.artifacts?.applicationArchiveUrl ?? build.artifacts?.buildUrl ?? '');
    assert.equal(artifact.protocol, 'https:', 'Missing HTTPS binary artifact');
  }
  return builds;
}

export async function verifyDownloads(builds: Build[], fetcher: typeof fetch = fetch) {
  for (const build of builds) {
    const url = build.artifacts.applicationArchiveUrl ?? build.artifacts.buildUrl!;
    const response = await fetcher(url, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(30_000) });
    assert(response.ok, `Binary unavailable for ${build.platform}: HTTP ${response.status}`);
    const reader = response.body?.getReader();
    try {
      const first = await reader?.read();
      assert(first?.value?.byteLength, `Empty binary for ${build.platform}`);
    } finally {
      await reader?.cancel();
    }
  }
}
