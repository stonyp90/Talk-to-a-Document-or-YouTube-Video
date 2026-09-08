import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Public test fixtures, never credentials. CI builds with these exact values.
export const canaries = {
  OPENAI_API_KEY: 'ci_canary_OPENAI_clearlyfakefixture_2026',
  AWS_SECRET_ACCESS_KEY: 'ci_canary_AWS_clearlyfakefixture_2026',
};

export async function scanClientSecrets(directory) {
  let files = 0;
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const target = join(path, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) {
        files++;
        const content = await readFile(target);
        for (const [name, fixture] of Object.entries(canaries)) {
          if (content.includes(Buffer.from(fixture))) throw new Error(`${name} canary leaked into a built client asset`);
        }
      }
    }
  }
  await visit(directory);
  if (files === 0) throw new Error('Client output is empty; secret separation is unverified');
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  for (const [name, fixture] of Object.entries(canaries)) {
    if (process.env[name] !== fixture) throw new Error(`Build canary fixture is required in ${name}`);
  }
  const count = await scanClientSecrets(resolve(process.argv[2] ?? '.next/static'));
  console.log(`Built-client canary check passed across ${count} assets; both fake secret values are absent.`);
}
