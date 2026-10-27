import { mkdir, readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, githubReader, repository as repoName } from './lineage-policy.mjs';
const args = process.argv.slice(2), value = key => args[args.indexOf(key) + 1];
const requireArg = key => { if (!args.includes(key) || !value(key)) throw Error('Required: ' + key); return value(key); };
const base = fileURLToPath(new URL('../', import.meta.url)), template = join(base, 'templates', 'owner-rights');
const id = requireArg('--id'), repository = requireArg('--repository'), target = resolve(requireArg('--target'));
if (!/^[a-z][a-z0-9-]{1,70}$/.test(id) || !/^https:\/\/github\.com\/shwhwhwh\/[A-Za-z0-9_.-]+$/.test(repository)) throw Error('Use an owner-controlled repository and a stable project id');
const existing = await readdir(target).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
if (existing.some(name => name !== '.git')) throw Error('Use a new empty repository directory; existing projects require a reviewed license transition');
const registry = JSON.parse(await readFile(join(base, 'projects.json'), 'utf8')), policy = JSON.parse(await readFile(join(base, 'rights/policy.json'), 'utf8'));
const parent = args.includes('--parent') ? registry.projects.find(p => p.id === value('--parent')) : null;
if (args.includes('--parent') && !parent) throw Error('Choose a registered parent project');
const upstreams = [];
if (parent) {
  const remote = githubReader();
  upstreams.push({ id: parent.id, repository: parent.repository, commit: parent.commit, owner: parent.owner });
  if (parent.parentId !== null) {
    const origin = JSON.parse(await remote(repoName(parent.repository), 'PROTOTYPE_ORIGIN.json', parent.commit));
    if (origin.projectId !== parent.id || !Array.isArray(origin.upstream)) throw Error('Parent provenance requires review');
    for (const entry of origin.upstream) {
      const registered = registry.projects.find(p => p.id === entry.id);
      if (!registered || entry.repository !== registered.repository || entry.owner !== registered.owner || !/^[a-f0-9]{40}$/.test(entry.commit)) throw Error('Invalid ancestor');
      upstreams.push({ id: entry.id, repository: entry.repository, commit: entry.commit, owner: entry.owner });
    }
  }
  for (const entry of upstreams) {
    entry.text = await remote(repoName(entry.repository), 'LICENSE', entry.commit);
    const anchor = policy.originals.find(p => p.id === entry.id);
    let historical = entry.commit === anchor?.commit ? anchor.historyManifest || [] : [];
    if (!anchor && registry.projects.find(p => p.id === entry.id)?.rightsHolderLogin === 'shwhwhwh') historical = JSON.parse(await remote(repoName(entry.repository), 'LICENSING.json', entry.commit)).historical || [];
    entry.historicalNotices = [];
    for (const [index, notice] of historical.entries()) {
      const text = await remote(repoName(entry.repository), notice.licenseFile, entry.commit);
      if (digest(text) !== notice.licenseSha256) throw Error('Historical notice hash mismatch');
      entry.historicalNotices.push({ sourceFile: notice.licenseFile, file: `LICENSES/${entry.id}-history-${index}.txt`, text });
    }
  }
}
await mkdir(join(target, '.github', 'workflows'), { recursive: true }); await mkdir(join(target, 'scripts'), { recursive: true });
for (const name of ['LICENSE', 'COMMERCIAL_LICENSE.md', 'CONTRIBUTOR_AGREEMENT.md']) await copyFile(join(template, name), join(target, name));
await copyFile(join(template, 'check-license-policy.mjs'), join(target, 'scripts', 'check-license-policy.mjs'));
await copyFile(join(template, 'rights-workflow.yml'), join(target, '.github', 'workflows', 'rights.yml'));
await writeFile(join(target, '.github', 'PULL_REQUEST_TEMPLATE.md'), (await readFile(join(template, 'PULL_REQUEST_TEMPLATE.md'), 'utf8')).replace('../blob/main/CONTRIBUTOR_AGREEMENT.md', repository + '/blob/main/CONTRIBUTOR_AGREEMENT.md'));
await writeFile(join(target, '.github', 'CODEOWNERS'), '* @shwhwhwh\n');
const manifest = { schemaVersion: 1, projectId: id, repository, rightsHolder: policy.ownerDefaults.rightsHolder, rightsHolderLogin: 'shwhwhwh', policyId: policy.ownerDefaults.policyId, licenseSha256: digest(await readFile(join(template, 'LICENSE'), 'utf8')), policyVersion: '1.0', appliesTo: 'New original material whose rights the owner has authority to license; previous and third-party grants are unaffected.', commercialPermission: 'separate-written-authorization', contributorAgreement: 'PP-CLA-1.0', historical: [] };
await writeFile(join(target, 'LICENSING.json'), JSON.stringify(manifest, null, 2) + '\n');
let parentNotice = '';
if (parent) {
  await mkdir(join(target, 'LICENSES'), { recursive: true });
  for (const entry of upstreams) {
    await writeFile(join(target, 'LICENSES', entry.id + '.txt'), entry.text);
    for (const notice of entry.historicalNotices) await writeFile(join(target, notice.file), notice.text);
  }
  await writeFile(join(target, 'PROTOTYPE_ORIGIN.json'), JSON.stringify({ schemaVersion: 1, projectId: id, repository,
    usageScope: 'owner-maintained', parent: { id: parent.id, repository: parent.repository, commit: parent.commit }, changes: 'Describe your original additions before registering.',
    upstream: upstreams.map(({ text, historicalNotices, ...entry }) => ({ ...entry, licenseFile: 'LICENSES/' + entry.id + '.txt', historicalNotices: historicalNotices.map(({ text, ...notice }) => notice) })) }, null, 2) + '\n');
  parentNotice = '\n' + upstreams.map(entry => `Upstream ${entry.id}: ${entry.repository}\nOriginal author: ${entry.owner}; source ${entry.commit}; preserve LICENSES/${entry.id}.txt.`).join('\n') + '\nNo commercial rights beyond the actual upstream licenses are implied.\n';
}
await writeFile(join(target, 'README.md'), `# ${id}\n\nCopyright © 2026 Rui Li (@shwhwhwh). All rights reserved.\nFree personal study/noncommercial experiments under LICENSE; commercial permission is separate.\nCollaboration welcome under CONTRIBUTOR_AGREEMENT.md.\n${parentNotice}`);
await writeFile(join(target, 'AGENTS.md'), 'Follow LICENSE and LICENSING.json. Preserve prior grants and third-party rights. Owner-created new material defaults to reserved rights with free personal study/noncommercial experiments; commercial authorization is separate. Collaboration requires the documented contribution grant.\n');
console.log(`Prepared owner rights in ${target}; review authorship, add original code, commit, and register the actual immutable SHA.`);
