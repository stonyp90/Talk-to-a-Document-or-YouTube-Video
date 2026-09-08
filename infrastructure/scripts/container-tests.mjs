import http from 'node:http';
import { spawn } from 'node:child_process';
import { scanClientSecrets } from './check-client-secrets.mjs';

await scanClientSecrets('.next/static');

// Browser POST URLs are signed for localhost:9002. The runner shares web's
// namespace; forward this port to real MinIO without modifying the signed Host.
// No Docker socket or host CLI is exposed to the container.
const proxy = http.createServer((request, response) => {
  const upstream = http.request({ hostname: 'object-store', port: 9000, path: request.url, method: request.method, headers: request.headers }, result => {
    response.writeHead(result.statusCode ?? 502, result.headers);
    result.pipe(response);
  });
  upstream.on('error', () => { response.writeHead(502); response.end('Local object store unavailable'); });
  request.pipe(upstream);
});
await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(9002, '127.0.0.1', resolve); });
try {
  for (const args of [
    ['run', 'lint'], ['run', 'typecheck'], ['test'],
    ['run', 'test:gherkin', '--', '--tags', 'not @external and not @host'],
    ['run', 'test:e2e'],
  ]) {
    const exit = await new Promise((resolve, reject) => {
      const child = spawn('npm', args, { stdio: 'inherit' });
      child.once('error', reject);
      child.once('exit', code => resolve(code ?? 1));
    });
    if (exit !== 0) { process.exitCode = exit; break; }
  }
} finally {
  proxy.closeAllConnections();
  await new Promise(resolve => proxy.close(resolve));
}
