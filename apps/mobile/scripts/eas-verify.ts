import { readFileSync } from 'node:fs';
import { validateEnvironment, validateBuilds, verifyDownloads } from './eas-contract';

async function main() {
  validateEnvironment(process.env);
  if (process.argv[2] === 'environment') return;
  const builds = validateBuilds(JSON.parse(readFileSync(process.argv[2], 'utf8')), process.env.TESTED_SHA ?? '', process.env.EXPO_PROJECT_ID!);
  await verifyDownloads(builds);
  for (const build of builds) console.log(`${build.platform}: FINISHED, binary accessible, tested SHA ${build.gitCommitHash}, EAS build ${build.id}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'EAS verification failed');
  process.exitCode = 1;
});
