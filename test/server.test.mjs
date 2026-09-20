import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('preview serves vendored JavaScript with module-compatible MIME under a Pages subpath', async t => {
  const root = resolve('test', '.backend-fixtures', 'preview-module-mime');
  await mkdir(resolve(root, 'oss-contributions', 'vendor'), { recursive: true });
  await writeFile(resolve(root, 'oss-contributions', 'vendor', 'proof.js'), 'export const proof = true;\n');
  await writeFile(resolve(root, 'oss-contributions', 'THIRD-PARTY-LICENSES.txt'), 'Fixture license');
  const child = spawn(process.execPath, [resolve('scripts', 'serve.mjs'), root, '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => {
    if (child.exitCode === null) { const exit = once(child, 'exit'); child.kill(); await exit; }
    await rm(root, { recursive: true, force: true });
  });
  const address = await new Promise((accept, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Preview startup timed out')); }, 10000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Preview exited before startup: ${code}`)); });
    child.stdout.on('data', data => {
      const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timeout); accept(match[0]); }
    });
  });
  const response = await fetch(`${address}/oss-contributions/vendor/proof.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/javascript/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), 'export const proof = true;\n');
  const license = await fetch(`${address}/oss-contributions/THIRD-PARTY-LICENSES.txt`);
  assert.match(license.headers.get('content-type'), /^text\/plain/);
  assert.equal(await license.text(), 'Fixture license');
});
