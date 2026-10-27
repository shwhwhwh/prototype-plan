import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const repoPattern = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;
const shaPattern = /^[a-f0-9]{40}$/;
export const normalize = text => text.replace(/\r\n/g, '\n').trim();
export const digest = text => createHash('sha256').update(normalize(text)).digest('hex');
const insist = (condition, message) => { if (!condition) throw new Error(message); };
export function repository(value) {
  const match = typeof value === 'string' && value.match(repoPattern);
  insist(match && !match[2].endsWith('.git'), 'Use a canonical public GitHub repository URL without .git');
  return match.slice(1).join('/');
}
function filePath(value) {
  insist(typeof value === 'string' && value.length < 240 && /^[A-Za-z0-9_./-]+$/.test(value)
    && !value.startsWith('/') && !value.split('/').some(part => !part || part === '.' || part === '..'), 'Unsafe repository file path');
  return value;
}
export function validateRegistry(registry, policy) {
  insist(registry.schemaVersion === 2 && Array.isArray(registry.projects), 'Expected projects.json schemaVersion 2');
  insist(registry.projects.length <= 150, 'Catalog limit is 150 projects');
  const ids = new Map(), repos = new Set();
  for (const item of registry.projects) {
    insist(/^[a-z][a-z0-9-]{1,70}$/.test(item.id) && !ids.has(item.id), 'Invalid or duplicate project id');
    insist(typeof item.name === 'string' && item.name.length <= 100 && item.name.length > 0, 'Invalid project name');
    insist(typeof item.owner === 'string' && item.owner.length < 160 && item.owner.length > 0, 'Missing project owner');
    const repo = repository(item.repository).toLowerCase();
    insist(!repos.has(repo), 'Duplicate project repository'); repos.add(repo);
    insist(shaPattern.test(item.commit), 'Every project requires a full immutable commit SHA');
    insist(item.parentId === null || typeof item.parentId === 'string', 'parentId must be explicit');
    ids.set(item.id, item);
  }
  for (const anchor of policy.originals) {
    const item = ids.get(anchor.id);
    insist(item && item.parentId === null && item.repository === anchor.repository && item.owner === anchor.owner
      && item.commit === anchor.commit && item.license === anchor.license, 'Original attribution/license/commit anchor changed: ' + anchor.id);
  }
  for (const item of registry.projects) {
    const seen = new Set(); let current = item;
    while (current.parentId !== null) {
      insist(!seen.has(current.id), 'Lineage cycle'); seen.add(current.id);
      current = ids.get(current.parentId); insist(current, 'Unknown parent');
    }
    insist(policy.originals.some(root => root.id === current.id), 'Unreviewed original project');
    insist(item.parentId === null || item.originFile === 'PROTOTYPE_ORIGIN.json', 'Derived projects require PROTOTYPE_ORIGIN.json');
  }
  return ids;
}
export function githubReader(token = process.env.GITHUB_TOKEN) {
  return async (repo, path, ref) => {
    insist(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo), 'Invalid repo'); filePath(path);
    insist(shaPattern.test(ref), 'Read only immutable commits');
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${ref}`, {
      redirect: 'error', signal: AbortSignal.timeout(20000), headers: {
        Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    insist(response.ok, `GitHub file unavailable (${response.status}): ${repo}/${path}`);
    const data = await response.json();
    insist(data.type === 'file' && data.encoding === 'base64' && data.size <= 262144, 'Expected a small plain repository file');
    return Buffer.from(data.content, 'base64').toString('utf8');
  };
}
export async function audit(registry, policy, read, loadSnapshot, options = {}) {
  const ids = validateRegistry(registry, policy), checks = new Map();
  const report = { schemaVersion: 1, checkedAt: new Date().toISOString(), scope: 'registered immutable commits only', projects: [] };
  const auditItem = async item => {
    if (checks.has(item.id)) return checks.get(item.id);
    const result = { id: item.id, name: item.name, owner: item.owner, repository: item.repository, commit: item.commit,
      parentId: item.parentId, license: item.license, original: item.parentId === null, status: 'blocked', reasons: [] };
    checks.set(item.id, result);
    try {
      const repo = repository(item.repository);
      if (item.parentId === null) {
        const anchor = policy.originals.find(root => root.id === item.id);
        const snapshot = await loadSnapshot(anchor.snapshot);
        insist(digest(snapshot) === anchor.licenseSha256, 'Trusted license snapshot hash mismatch');
        insist(digest(await read(repo, 'LICENSE', item.commit)) === anchor.licenseSha256, 'Original LICENSE differs from recorded version');
      } else {
        const parent = ids.get(item.parentId), parentCheck = await auditItem(parent);
        insist(parentCheck.status === 'passed', 'Parent checks have not passed');
        const origin = JSON.parse(await read(repo, 'PROTOTYPE_ORIGIN.json', item.commit));
        insist(origin.schemaVersion === 1 && origin.projectId === item.id && origin.repository === item.repository, 'Origin manifest identity mismatch');
        insist(origin.parent?.id === parent.id && origin.parent.repository === parent.repository && origin.parent.commit === parent.commit, 'Origin manifest parent mismatch');
        insist(typeof origin.changes === 'string' && origin.changes.trim().length > 0, 'Describe derivative changes');
        const readme = await read(repo, 'README.md', item.commit);
        insist(readme.includes(parent.repository), 'README must link the immediate parent repository');
        const ancestors = []; let current = parent;
        while (current) { ancestors.push(current); current = ids.get(current.parentId); }
        insist(Array.isArray(origin.upstream) && origin.upstream.length === ancestors.length, 'List every upstream ancestor, with no substitutions');
        for (const upstream of ancestors) {
          const entry = origin.upstream.find(record => record.id === upstream.id);
          insist(entry && entry.repository === upstream.repository && entry.commit === upstream.commit && entry.owner === upstream.owner, 'Upstream ownership/commit mismatch: ' + upstream.id);
          const upstreamLicense = await read(repository(upstream.repository), 'LICENSE', upstream.commit);
          const preserved = await read(repo, filePath(entry.licenseFile), item.commit);
          insist(normalize(preserved).includes(normalize(upstreamLicense)), 'Full upstream license/copyright notice missing: ' + upstream.id);
          insist(readme.includes(upstream.repository) && readme.includes(upstream.owner), 'README attribution missing: ' + upstream.id);
          const anchor = policy.originals.find(root => root.id === upstream.id);
          if (!anchor || anchor.permission === 'explicit-grant') {
            const grant = policy.grants.find(grant => grant.id === entry.grantId && grant.upstreamId === upstream.id
              && grant.repository === item.repository && grant.commit === (options.checkedCommit?.(item) || item.commit) && grant.rightsHolder === upstream.owner
              && grant.approvedBy === 'shwhwhwh' && grant.scopes?.includes('derive-and-redistribute'));
            insist(grant && /^https:\/\/github\.com\//.test(grant.evidenceUrl), 'Maintainer-reviewed author grant required: ' + upstream.id);
          }
        }
        insist(typeof item.license === 'string' && item.license.length > 0, 'Declare derivative terms without replacing upstream terms');
        insist((await read(repo, 'LICENSE', item.commit)).trim().length > 20, 'Derivative LICENSE is missing');
      }
      result.status = 'passed';
    } catch (error) { result.reasons.push(error.message); }
    return result;
  };
  for (const item of registry.projects) await auditItem(item);
  report.projects = [...checks.values()];
  report.ok = report.projects.every(project => project.status === 'passed');
  return report;
}
async function main() {
  const args = process.argv.slice(2), value = name => args[args.indexOf(name) + 1];
  const registryPath = args.includes('--registry') ? value('--registry') : 'projects.json';
  const policyDir = args.includes('--policy-dir') ? value('--policy-dir') : '.';
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const policy = JSON.parse(await readFile(`${policyDir}/rights/policy.json`, 'utf8'));
  const read = githubReader(), snapshot = path => readFile(`${policyDir}/${filePath(path)}`, 'utf8');
  const report = await audit(registry, policy, read, snapshot);
  const heads = new Map();
  for (const item of registry.projects) {
    const repo = repository(item.repository);
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/commits/HEAD`, {
        redirect: 'error', signal: AbortSignal.timeout(20000), headers: { Accept: 'application/vnd.github+json',
          ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }
      });
      insist(response.ok, 'Default branch is unavailable');
      const head = await response.json(); insist(shaPattern.test(head.sha), 'Invalid default branch commit'); heads.set(repo, head.sha);
    } catch { heads.set(repo, null); }
  }
  const live = await audit(registry, policy, (repo, path) => {
    const ref = heads.get(repo); insist(ref, 'Default branch check unavailable'); return read(repo, path, ref);
  }, snapshot, { checkedCommit: item => heads.get(repository(item.repository)) });
  for (const item of report.projects) {
    const current = live.projects.find(project => project.id === item.id);
    item.headCommit = heads.get(repository(item.repository));
    item.headStatus = current.status;
    if (current.status !== 'passed') { item.status = 'blocked'; item.reasons.push(...current.reasons.map(reason => 'Default branch: ' + reason)); }
  }
  report.ok = report.projects.every(project => project.status === 'passed');
  report.scope = 'registered commits and current default-branch attribution files';
  report.registryCommit = process.env.GITHUB_SHA || null;
  if (args.includes('--output')) await writeFile(value('--output'), JSON.stringify(report, null, 2) + '\n');
  for (const project of report.projects) console.log(`${project.status}: ${project.id}${project.reasons.length ? ' - ' + project.reasons.join('; ') : ''}`);
  if (!report.ok) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
