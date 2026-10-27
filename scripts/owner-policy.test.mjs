import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const scaffold = join(root, 'scripts', 'scaffold-owner-rights.mjs');
const check = join(root, 'templates', 'owner-rights', 'check-license-policy.mjs');
const run = (path, args, env = {}) => spawnSync(process.execPath, [path, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_EVENT_NAME: '', ...env } });
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'prototype-owner-rights-'));
  const result = run(scaffold, ['--target', dir, '--id', 'fixture-project', '--repository', 'https://github.com/shwhwhwh/fixture-project']);
  assert.equal(result.status, 0, result.stderr); return dir;
}
async function cleanup(dir) {
  const resolved = resolve(dir), parent = resolve(tmpdir()) + sep;
  assert(resolved.startsWith(parent) && resolved.slice(parent.length).startsWith('prototype-owner-rights-'));
  await rm(resolved, { recursive: true });
}
test('new owner project scaffold has reserved/free-use terms and commercial/collaboration files', async () => {
  const dir = await fixture(); try {
    const result = run(check, ['--root', dir]); assert.equal(result.status, 0, result.stderr);
    const files = await readdir(dir); assert(files.includes('LICENSE') && files.includes('COMMERCIAL_LICENSE.md') && files.includes('CONTRIBUTOR_AGREEMENT.md'));
    const manifest = JSON.parse(await readFile(join(dir, 'LICENSING.json'), 'utf8')); assert.equal(manifest.rightsHolderLogin, 'shwhwhwh'); assert.equal(manifest.historical.length, 0); assert.equal(manifest.scope, 'all-owner-controlled-material-in-official-distribution'); assert.equal(manifest.policyVersion, '1.1');
    const template = await readFile(join(dir, '.github', 'PULL_REQUEST_TEMPLATE.md'), 'utf8'); assert(!/^CLA-ACCEPTED: PP-CLA-1\.0\s*$/m.test(template));
    const repeat = run(scaffold, ['--target', dir, '--id', 'fixture-project', '--repository', 'https://github.com/shwhwhwh/fixture-project']); assert.notEqual(repeat.status, 0);
  } finally { await cleanup(dir); }
});
test('external PR must deliberately attest; owner contribution does not require a self-grant', async () => {
  const dir = await fixture(), eventPath = join(dir, 'event.json'); try {
    const event = { pull_request: { user: { login: 'fixture-contributor' }, body: 'CLA-ACCEPTED: <placeholder>' } };
    await writeFile(eventPath, JSON.stringify(event));
    const env = { GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: eventPath };
    assert.notEqual(run(check, ['--root', dir], env).status, 0);
    event.pull_request.body = 'CLA-ACCEPTED: PP-CLA-1.0'; await writeFile(eventPath, JSON.stringify(event)); assert.equal(run(check, ['--root', dir], env).status, 0);
    event.pull_request.user.login = 'shwhwhwh'; event.pull_request.body = ''; await writeFile(eventPath, JSON.stringify(event)); assert.equal(run(check, ['--root', dir], env).status, 0);
  } finally { await cleanup(dir); }
});
test('PR cannot rewrite reservation or commercial/contribution terms relative to trusted base', async () => {
  const trusted = await fixture(), candidate = await fixture(); try {
    await writeFile(join(candidate, 'COMMERCIAL_LICENSE.md'), 'All commercial uses are free now.');
    assert.notEqual(run(check, ['--root', candidate, '--trusted', trusted]).status, 0);
  } finally { await cleanup(trusted); await cleanup(candidate); }
});

test('official offer cannot narrow scope to new additions, drop safeguards or roll back its policy', async () => {
  const trusted = await fixture(), candidate = await fixture(); try {
    const original = JSON.parse(await readFile(join(candidate, 'LICENSING.json'), 'utf8'));
    assert.equal(run(check, ['--root', candidate, '--trusted', trusted]).status, 0);
    for (const mutation of [{scope:'new-material-only'}, {preservesPriorGrants:false}, {preservesThirdPartyLicenses:false}, {policyId:'LicenseRef-Prototype-Plan-Personal-Noncommercial-1.0'}]) {
      await writeFile(join(candidate,'LICENSING.json'),JSON.stringify({...original,...mutation}));
      assert.notEqual(run(check,['--root',candidate,'--trusted',trusted]).status,0,JSON.stringify(mutation));
    }
  } finally { await cleanup(trusted); await cleanup(candidate); }
});

test('changing the current offer still requires the exact earlier policy archive', async () => {
  const trusted = await fixture(), candidate = await fixture(); try {
    const archive = await readFile(join(root,'rights/history/prototype-plan-personal-noncommercial-1.0.txt'),'utf8');
    const hash = createHash('sha256').update(archive.replace(/\r\n/g,'\n').trim()).digest('hex');
    for (const dir of [trusted,candidate]) {
      await mkdir(join(dir,'LICENSES'));
      await writeFile(join(dir,'LICENSES/previous.txt'),archive);
      const manifest=JSON.parse(await readFile(join(dir,'LICENSING.json'),'utf8'));
      manifest.historical=[{throughCommit:'a'.repeat(40),license:'LicenseRef-Prototype-Plan-Personal-Noncommercial-1.0',licenseFile:'LICENSES/previous.txt',licenseSha256:hash}];
      await writeFile(join(dir,'LICENSING.json'),JSON.stringify(manifest));
    }
    assert.equal(run(check,['--root',candidate,'--trusted',trusted]).status,0);
    await writeFile(join(candidate,'LICENSES/previous.txt'),'All previous grants are revoked.');
    assert.notEqual(run(check,['--root',candidate,'--trusted',trusted]).status,0);
  } finally { await cleanup(trusted); await cleanup(candidate); }
});
