import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audit, digest, validateRegistry, repository, githubReader } from './lineage-policy.mjs';
const sha = '1'.repeat(40), childSha = '2'.repeat(40);
const license = 'MIT License\nCopyright (c) 2026 Original Owner\nPermission is hereby granted, free of charge.\nTHE SOFTWARE IS PROVIDED AS IS.';
const root = { id: 'root-project', name: 'Root', owner: 'Original Owner', repository: 'https://github.com/example/root', commit: sha, parentId: null, license: 'MIT' };
const child = { id: 'child-project', name: 'Child', owner: 'Contributor', repository: 'https://github.com/example/child', commit: childSha, parentId: root.id, license: 'Custom derivative terms', originFile: 'PROTOTYPE_ORIGIN.json' };
function fixture(permission = 'license') {
  const policy = { originals: [{ ...root, snapshot: 'rights/root.txt', licenseSha256: digest(license), permission }], grants: [] };
  const origin = { schemaVersion: 1, projectId: child.id, repository: child.repository, parent: { id: root.id, repository: root.repository, commit: sha }, changes: 'Adds an interface', upstream: [{ id: root.id, repository: root.repository, commit: sha, owner: root.owner, licenseFile: 'LICENSES/root.txt' }] };
  const files = { 'example/root/LICENSE': license, 'example/child/LICENSE': 'Derivative contribution terms only; upstream terms preserved.', 'example/child/LICENSES/root.txt': license, 'example/child/README.md': `${root.owner} ${root.repository}`, 'example/child/PROTOTYPE_ORIGIN.json': JSON.stringify(origin) };
  const run = (options = {}) => audit({ schemaVersion: 2, projects: [root, child] }, policy, async (repo, path) => { const text = files[repo + '/' + path]; if (!text) throw Error('File missing'); return text; }, async () => license, options);
  return { policy, origin, files, run };
}
test('preserved ownership, immutable parent and full MIT notice pass', async () => { assert.equal((await fixture().run()).ok, true); });
test('removing license text blocks display even when copyright name remains', async () => { const f = fixture(); f.files['example/child/LICENSES/root.txt'] = 'Copyright (c) 2026 Original Owner'; assert.equal((await f.run()).ok, false); });
test('self-declared permission is insufficient for restricted upstream', async () => { assert.equal((await fixture('explicit-grant').run()).ok, false); });
test('reviewed grant is bound to exact derivative repository and commit', async () => {
  const f = fixture('explicit-grant'); f.origin.upstream[0].grantId = 'grant-1'; f.files['example/child/PROTOTYPE_ORIGIN.json'] = JSON.stringify(f.origin);
  f.policy.grants.push({ id: 'grant-1', upstreamId: root.id, repository: child.repository, commit: childSha, rightsHolder: root.owner, approvedBy: 'shwhwhwh', scopes: ['derive-and-redistribute'], evidenceUrl: 'https://github.com/example/root/issues/1' });
  assert.equal((await f.run()).ok, true);
  assert.equal((await f.run({ checkedCommit: () => '9'.repeat(40) })).ok, false);
  f.policy.grants[0].commit = sha; assert.equal((await f.run()).ok, false);
});
test('cycles, duplicate repo, unknown parent and changed original anchor rejected', () => {
  const f = fixture();
  for (const items of [[{ ...root, owner: 'Someone else' }], [root, { ...child, parentId: 'missing' }], [root, { ...child, repository: root.repository }], [root, { ...child, parentId: child.id }]]) assert.throws(() => validateRegistry({ schemaVersion: 2, projects: items }, f.policy));
});
test('source mismatch and path traversal are rejected', async () => {
  const f = fixture(); f.origin.parent.commit = childSha; f.files['example/child/PROTOTYPE_ORIGIN.json'] = JSON.stringify(f.origin); assert.equal((await f.run()).ok, false);
  f.origin.parent.commit = sha; f.origin.upstream[0].licenseFile = '../secrets'; f.files['example/child/PROTOTYPE_ORIGIN.json'] = JSON.stringify(f.origin); assert.equal((await f.run()).ok, false);
  assert.throws(() => repository('https://github.com/../secret?token=x')); assert.throws(() => repository('http://127.0.0.1/private'));
});
test('all ancestors must be retained, not just the immediate parent', async () => {
  const f = fixture();
  const grandchild = { ...child, id: 'grandchild-project', repository: 'https://github.com/example/grandchild', parentId: child.id, commit: '3'.repeat(40) };
  const origin = { ...f.origin, projectId: grandchild.id, repository: grandchild.repository, parent: { id: child.id, repository: child.repository, commit: child.commit }, upstream: [{ id: child.id, owner: child.owner, repository: child.repository, commit: child.commit, licenseFile: 'LICENSES/child.txt' }] };
  f.files['example/grandchild/PROTOTYPE_ORIGIN.json'] = JSON.stringify(origin);
  const report = await audit({ schemaVersion: 2, projects: [root, child, grandchild] }, f.policy, async (repo, path) => f.files[repo + '/' + path] || '', async () => license);
  assert.equal(report.projects.find(p => p.id === grandchild.id).status, 'blocked');
});
test('network failures block verification rather than granting permission', async () => {
  const f = fixture(); const report = await audit({ schemaVersion: 2, projects: [root, child] }, f.policy, async () => { throw Error('Network unavailable'); }, async () => license);
  assert(report.projects.every(p => p.status === 'blocked'));
});
test('rewriting upstream owner or removing README credit blocks admission', async () => {
  const f = fixture(); f.origin.upstream[0].owner = 'Contributor'; f.files['example/child/PROTOTYPE_ORIGIN.json'] = JSON.stringify(f.origin);
  assert.equal((await f.run()).ok, false);
  f.origin.upstream[0].owner = root.owner; f.files['example/child/PROTOTYPE_ORIGIN.json'] = JSON.stringify(f.origin);
  f.files['example/child/README.md'] = root.repository; assert.equal((await f.run()).ok, false);
});
test('private repositories are rejected before reading any contents', async () => {
  const previous = globalThis.fetch; const requests = [];
  try {
    globalThis.fetch = async url => { requests.push(url); return { ok: true, json: async () => ({ private: true }) }; };
    await assert.rejects(() => githubReader('test-only-token')('example/private', 'LICENSE', sha), /Only public/);
    assert.deepEqual(requests, ['https://api.github.com/repos/example/private']);
  } finally { globalThis.fetch = previous; }
});
