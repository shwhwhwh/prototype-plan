import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audit, digest, validateRegistry, repository, githubReader } from './lineage-policy.mjs';
import { readFile } from 'node:fs/promises';
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

const canonicalLicense = await readFile(new URL('../templates/owner-rights/LICENSE', import.meta.url), 'utf8');
const commercialTerms = await readFile(new URL('../templates/owner-rights/COMMERCIAL_LICENSE.md', import.meta.url), 'utf8');
const contributorTerms = await readFile(new URL('../templates/owner-rights/CONTRIBUTOR_AGREEMENT.md', import.meta.url), 'utf8');
function modernFixture(scope = 'noncommercial-experiment', ownerChild = false) {
  const owner = 'Rui Li (@shwhwhwh)', policyId = 'LicenseRef-Prototype-Plan-Personal-Noncommercial-1.1';
  const original = { ...root, owner, repository: 'https://github.com/shwhwhwh/root', rightsHolderLogin: 'shwhwhwh', license: policyId };
  const derived = { ...child, usageScope: scope, ...(ownerChild ? { owner, repository: 'https://github.com/shwhwhwh/child', rightsHolderLogin: 'shwhwhwh', license: policyId } : {}) };
  const defaults = { scope: 'all-owner-controlled-material-in-official-distribution', ownerLogin: 'shwhwhwh', rightsHolder: owner, policyId, licenseSha256: digest(canonicalLicense), commercialSha256: digest(commercialTerms), contributorSha256: digest(contributorTerms) };
  const makeManifest = item => ({ schemaVersion: 1, projectId: item.id, repository: item.repository, rightsHolder: owner, rightsHolderLogin: 'shwhwhwh', policyId, licenseSha256: digest(canonicalLicense), contributorAgreement: 'PP-CLA-1.0', policyVersion: '1.1', scope: 'all-owner-controlled-material-in-official-distribution', preservesPriorGrants: true, preservesThirdPartyLicenses: true, historical: [] });
  const policy = { ownerDefaults: defaults, originals: [{ ...original, permission: 'personal-noncommercial', snapshot: 'rights/new.txt', licenseSha256: digest(canonicalLicense), historyManifest: [], historical: [{ commit: '4'.repeat(40), license: 'MIT', permission: 'license', licenseSha256: digest(license) }] }], grants: [] };
  const files = new Map();
  const put = (item, path, value) => files.set(repository(item.repository) + '/' + path, value);
  function addOwnerFiles(item) {
    put(item, 'LICENSE', canonicalLicense); put(item, 'LICENSING.json', JSON.stringify(makeManifest(item)));
    put(item, 'COMMERCIAL_LICENSE.md', commercialTerms); put(item, 'CONTRIBUTOR_AGREEMENT.md', contributorTerms);
  }
  addOwnerFiles(original); if (ownerChild) addOwnerFiles(derived); else put(derived, 'LICENSE', 'Original contributor terms with upstream notices preserved.');
  const origin = { schemaVersion: 1, projectId: derived.id, repository: derived.repository, usageScope: scope,
    parent: { id: original.id, repository: original.repository, commit: original.commit }, changes: 'Adds a prototype',
    upstream: [{ id: original.id, repository: original.repository, owner, commit: original.commit, licenseFile: 'LICENSES/root.txt' }] };
  put(derived, 'PROTOTYPE_ORIGIN.json', JSON.stringify(origin)); put(derived, 'README.md', owner + ' ' + original.repository); put(derived, 'LICENSES/root.txt', canonicalLicense);
  const read = async (repo, path, ref) => repo === 'shwhwhwh/root' && path === 'LICENSE' && ref === '4'.repeat(40) ? license : files.get(repo + '/' + path) || '';
  const run = () => audit({ schemaVersion: 3, projects: [original, derived] }, policy, read, async () => canonicalLicense);
  return { original, derived, defaults, policy, files, origin, put, run, makeManifest, read };
}
test('new policy permits noncommercial derivatives without commercial author grants', async () => { assert.equal((await modernFixture().run()).ok, true); });

test('catalog rejects narrowed official scope and removed historical/third-party safeguards', async () => {
  for (const mutation of [{scope:'new-material-only'}, {preservesPriorGrants:false}, {preservesThirdPartyLicenses:false}]) {
    const f=modernFixture(), manifest={...f.makeManifest(f.original),...mutation};
    f.put(f.original,'LICENSING.json',JSON.stringify(manifest));
    const report=await f.run(); assert.equal(report.ok,false);
    assert.match(report.projects.find(p=>p.id===f.original.id).reasons.join(' '),/scope|safeguards/);
  }
});

test('historical limited-use source retains its embedded earlier notices after the current policy changes', async () => {
  const f=modernFixture(), previous='5'.repeat(40), prior='Prior policy 1.0: personal study and noncommercial use permitted; commercial authorization separate.';
  const history={throughCommit:'4'.repeat(40),license:'MIT',licenseFile:'LICENSES/legacy-MIT.txt',licenseSha256:digest(license)};
  f.policy.originals[0].historical.push({commit:previous,license:'LicenseRef-Prototype-Plan-Personal-Noncommercial-1.0',permission:'personal-noncommercial',licenseSha256:digest(prior),historyManifest:[history]});
  f.derived.parentCommit=previous;f.origin.parent.commit=previous;f.origin.upstream[0].commit=previous;
  f.put(f.derived,'PROTOTYPE_ORIGIN.json',JSON.stringify(f.origin));f.put(f.derived,'LICENSES/root.txt',prior);
  const read=(repo,path,ref)=>repo==='shwhwhwh/root'&&path==='LICENSE'&&ref===previous?Promise.resolve(prior):f.read(repo,path,ref);
  const run=()=>audit({schemaVersion:3,projects:[f.original,f.derived]},f.policy,read,async()=>f.files.get('shwhwhwh/root/LICENSE'));
  assert.equal((await run()).ok,false);
  f.origin.upstream[0].historicalNotices=[{sourceFile:'LICENSES/legacy-MIT.txt',file:'LICENSES/retained-MIT.txt'}];
  f.put(f.derived,'PROTOTYPE_ORIGIN.json',JSON.stringify(f.origin));f.put(f.derived,'LICENSES/retained-MIT.txt',license);
  assert.equal((await run()).ok,true);
});
test('new-policy commercial use requires a reviewed, version-bound author grant', async () => {
  const f = modernFixture('commercial'); assert.equal((await f.run()).ok, false);
  f.origin.upstream[0].grantId = 'commercial-1'; f.put(f.derived, 'PROTOTYPE_ORIGIN.json', JSON.stringify(f.origin));
  f.policy.grants.push({ id: 'commercial-1', upstreamId: f.original.id, repository: f.derived.repository, commit: f.derived.commit, rightsHolder: f.original.owner, approvedBy: 'shwhwhwh', scopes: ['derive-and-redistribute'], evidenceUrl: 'https://github.com/example/root/issues/2' });
  assert.equal((await f.run()).ok, false); f.policy.grants[0].scopes.push('commercial-use');
  assert.equal((await f.run()).ok, true);
});
test('owner-built derivatives retain the owner policy; author need not license to self', async () => {
  const f = modernFixture('owner-maintained', true); assert.equal((await f.run()).ok, true);
  f.derived.license = 'MIT'; await assert.rejects(f.run, /Owner-created projects/);
});
test('historical MIT remains commercially usable after the owner changes future defaults', async () => {
  const f = modernFixture('commercial'); f.derived.parentCommit = '4'.repeat(40);
  f.origin.parent.commit = f.derived.parentCommit; f.origin.upstream[0].commit = f.derived.parentCommit;
  f.put(f.derived, 'PROTOTYPE_ORIGIN.json', JSON.stringify(f.origin)); f.put(f.derived, 'LICENSES/root.txt', license);
  assert.equal((await f.run()).ok, true);
});
test('cannot disguise new restricted source as legacy MIT or change usage scope', async () => {
  const f = modernFixture('commercial'); f.put(f.derived, 'LICENSES/root.txt', license); assert.equal((await f.run()).ok, false);
  const other = modernFixture(); other.origin.usageScope = 'commercial'; other.put(other.derived, 'PROTOTYPE_ORIGIN.json', JSON.stringify(other.origin)); assert.equal((await other.run()).ok, false);
});
test('owner terms and historical archive boundary cannot be removed', async () => {
  const f = modernFixture(); f.put(f.original, 'COMMERCIAL_LICENSE.md', 'All free for any commercial use'); assert.equal((await f.run()).ok, false);
  const other = modernFixture(); const manifest = other.makeManifest(other.original); manifest.historical = [{ license: 'MIT', throughCommit: '4'.repeat(40) }]; other.put(other.original, 'LICENSING.json', JSON.stringify(manifest)); assert.equal((await other.run()).ok, false);
});
test('noncommercial free use follows multiple owner-built derivative generations', async () => {
  const f = modernFixture('owner-maintained', true);
  const grandchild = { ...child, id: 'grandchild-project', repository: 'https://github.com/example/grandchild', parentId: f.derived.id, commit: '3'.repeat(40), usageScope: 'noncommercial-experiment' };
  const origin = { schemaVersion: 1, projectId: grandchild.id, repository: grandchild.repository, usageScope: grandchild.usageScope,
    parent: { id: f.derived.id, repository: f.derived.repository, commit: f.derived.commit }, changes: 'Further experiment',
    upstream: [f.derived, f.original].map(p => ({ id: p.id, repository: p.repository, commit: p.commit, owner: p.owner, licenseFile: 'LICENSES/' + p.id + '.txt' })) };
  f.put(grandchild, 'PROTOTYPE_ORIGIN.json', JSON.stringify(origin)); f.put(grandchild, 'LICENSE', 'Contributor rights, with all upstream terms preserved.');
  f.put(grandchild, 'README.md', [f.derived, f.original].map(p => p.owner + ' ' + p.repository).join('\n'));
  for (const p of [f.derived, f.original]) f.put(grandchild, 'LICENSES/' + p.id + '.txt', canonicalLicense);
  const report = await audit({ schemaVersion: 3, projects: [f.original, f.derived, grandchild] }, f.policy, f.read, async () => canonicalLicense);
  assert.equal(report.ok, true); assert.equal(report.projects.find(p => p.id === grandchild.id).upstreamVersions.length, 2);
});
test('current source derivatives must also preserve embedded historical MIT notices', async () => {
  const f = modernFixture(), notice = { throughCommit: '4'.repeat(40), license: 'MIT', licenseFile: 'LICENSES/legacy-MIT.txt', licenseSha256: digest(license) };
  f.policy.originals[0].historyManifest = [notice]; const manifest = f.makeManifest(f.original); manifest.historical = [notice];
  f.put(f.original, 'LICENSING.json', JSON.stringify(manifest)); f.put(f.original, notice.licenseFile, license);
  assert.equal((await f.run()).ok, false);
  f.origin.upstream[0].historicalNotices = [{ sourceFile: notice.licenseFile, file: 'LICENSES/upstream-legacy-MIT.txt' }];
  f.put(f.derived, 'PROTOTYPE_ORIGIN.json', JSON.stringify(f.origin)); f.put(f.derived, 'LICENSES/upstream-legacy-MIT.txt', license);
  assert.equal((await f.run()).ok, true);
});
