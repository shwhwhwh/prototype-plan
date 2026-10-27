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
  insist([2, 3].includes(registry.schemaVersion) && Array.isArray(registry.projects), 'Expected projects.json schemaVersion 2 or 3');
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
    if (registry.schemaVersion >= 3 && item.parentId !== null) insist(['personal-study', 'noncommercial-experiment', 'contribution', 'commercial', 'owner-maintained'].includes(item.usageScope), 'Declare an explicit derivative use scope');
    if (policy.ownerDefaults && (repository(item.repository).split('/')[0].toLowerCase() === policy.ownerDefaults.ownerLogin || item.rightsHolderLogin === policy.ownerDefaults.ownerLogin || item.owner === policy.ownerDefaults.rightsHolder)) {
      insist(item.rightsHolderLogin === policy.ownerDefaults.ownerLogin && item.owner === policy.ownerDefaults.rightsHolder
        && item.license === policy.ownerDefaults.policyId, 'Owner-created projects must retain the declared reserved/limited-use default');
    }
  }
  return ids;
}
export function githubReader(token = process.env.GITHUB_TOKEN) {
  const publicRepos = new Set();
  return async (repo, path, ref) => {
    insist(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo), 'Invalid repo'); filePath(path);
    insist(shaPattern.test(ref), 'Read only immutable commits');
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    if (!publicRepos.has(repo)) {
      const metadata = await fetch(`https://api.github.com/repos/${repo}`, { redirect: 'error', signal: AbortSignal.timeout(20000), headers });
      insist(metadata.ok, 'Repository metadata unavailable');
      const details = await metadata.json(); insist(details.private === false, 'Only public project repositories may be indexed'); publicRepos.add(repo);
    }
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${ref}`, {
      redirect: 'error', signal: AbortSignal.timeout(20000), headers
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
  const subjectRef = item => {
    const ref = options.ownRef ? options.ownRef(item) : item.commit;
    insist(shaPattern.test(ref), 'Default branch check unavailable'); return ref;
  };
  const own = (item, path) => read(repository(item.repository), path, subjectRef(item));
  async function ownerPolicy(item, anchor) {
    const defaults = policy.ownerDefaults;
    if (!defaults || item.rightsHolderLogin !== defaults.ownerLogin) return;
    const manifest = JSON.parse(await own(item, 'LICENSING.json'));
    insist(manifest.schemaVersion === 1 && manifest.projectId === item.id && manifest.repository === item.repository
      && manifest.rightsHolder === defaults.rightsHolder && manifest.rightsHolderLogin === defaults.ownerLogin
      && manifest.policyId === defaults.policyId && manifest.licenseSha256 === defaults.licenseSha256, 'Owner policy manifest mismatch');
    if (defaults.scope) {
      insist(manifest.policyVersion === '1.1' && manifest.scope === defaults.scope, 'Official distribution scope mismatch');
      insist(manifest.preservesPriorGrants === true && manifest.preservesThirdPartyLicenses === true, 'Prior-grant/third-party safeguards missing');
    }
    insist(digest(await own(item, 'LICENSE')) === defaults.licenseSha256, 'Reserved/limited-use license changed');
    insist(digest(await own(item, 'COMMERCIAL_LICENSE.md')) === defaults.commercialSha256, 'Commercial permission terms changed');
    insist(digest(await own(item, 'CONTRIBUTOR_AGREEMENT.md')) === defaults.contributorSha256 && manifest.contributorAgreement === 'PP-CLA-1.0', 'Contribution terms changed');
    if (anchor?.historyManifest) insist(JSON.stringify(manifest.historical) === JSON.stringify(anchor.historyManifest), 'Historical grants/boundary changed');
    for (const historical of manifest.historical || []) insist(digest(await own(item, filePath(historical.licenseFile))) === historical.licenseSha256, 'Archived historical license changed');
  }
  const auditItem = async item => {
    if (checks.has(item.id)) return checks.get(item.id);
    const result = { id: item.id, name: item.name, owner: item.owner, repository: item.repository, commit: item.commit,
      parentId: item.parentId, license: item.license, rightsHolderLogin: item.rightsHolderLogin, usageScope: item.usageScope,
      original: item.parentId === null, status: 'blocked', reasons: [], upstreamVersions: [] };
    checks.set(item.id, result);
    try {
      const repo = repository(item.repository);
      if (item.parentId === null) {
        const anchor = policy.originals.find(root => root.id === item.id);
        const snapshot = await loadSnapshot(anchor.snapshot);
        insist(digest(snapshot) === anchor.licenseSha256, 'Trusted license snapshot hash mismatch');
        insist(digest(await own(item, 'LICENSE')) === anchor.licenseSha256, 'Original LICENSE differs from recorded version');
        await ownerPolicy(item, anchor);
      } else {
        const parent = ids.get(item.parentId), parentCheck = await auditItem(parent);
        insist(parentCheck.status === 'passed', 'Parent checks have not passed');
        const origin = JSON.parse(await own(item, 'PROTOTYPE_ORIGIN.json'));
        insist(origin.schemaVersion === 1 && origin.projectId === item.id && origin.repository === item.repository, 'Origin manifest identity mismatch');
        const parentCommit = item.parentCommit || parent.commit;
        const parentAnchor = policy.originals.find(root => root.id === parent.id);
        insist(parentCommit === parent.commit || parentAnchor?.historical?.some(version => version.commit === parentCommit), 'Unreviewed historical parent version');
        insist(origin.parent?.id === parent.id && origin.parent.repository === parent.repository && origin.parent.commit === parentCommit, 'Origin manifest parent mismatch');
        if (registry.schemaVersion >= 3) insist(origin.usageScope === item.usageScope, 'Origin use scope mismatch');
        insist(typeof origin.changes === 'string' && origin.changes.trim().length > 0, 'Describe derivative changes');
        const readme = await own(item, 'README.md');
        insist(readme.includes(parent.repository), 'README must link the immediate parent repository');
        const versions = [{ id: parent.id, commit: parentCommit }, ...(parentCheck.upstreamVersions || [])];
        insist(Array.isArray(origin.upstream) && origin.upstream.length === versions.length, 'List every upstream ancestor, with no substitutions');
        for (const version of versions) {
          const upstream = ids.get(version.id);
          const entry = origin.upstream.find(record => record.id === upstream.id);
          insist(entry && entry.repository === upstream.repository && entry.commit === version.commit && entry.owner === upstream.owner, 'Upstream ownership/commit mismatch: ' + upstream.id);
          const anchor = policy.originals.find(root => root.id === upstream.id);
          const ownerTerms = !anchor && upstream.rightsHolderLogin === policy.ownerDefaults?.ownerLogin && upstream.license === policy.ownerDefaults?.policyId
            ? { permission: 'personal-noncommercial', licenseSha256: policy.ownerDefaults.licenseSha256 } : null;
          const terms = version.commit === upstream.commit ? (anchor || ownerTerms) : anchor?.historical?.find(v => v.commit === version.commit);
          insist(!anchor || terms, 'Unknown upstream license version');
          const upstreamLicense = await read(repository(upstream.repository), 'LICENSE', version.commit);
          if (terms?.licenseSha256) insist(digest(upstreamLicense) === terms.licenseSha256, 'Upstream version license differs from trusted history');
          const preserved = await own(item, filePath(entry.licenseFile));
          insist(normalize(preserved).includes(normalize(upstreamLicense)), 'Full upstream license/copyright notice missing: ' + upstream.id);
          // A current RN source distribution still contains previously MIT-licensed material.
          // Preserving only its new top-level license must not discard those existing notices.
          let historicalNotices = terms?.historyManifest || [];
          if (ownerTerms) {
            const upstreamManifest = JSON.parse(await read(repository(upstream.repository), 'LICENSING.json', version.commit));
            insist(upstreamManifest.policyId === policy.ownerDefaults.policyId, 'Unknown intermediate owner policy');
            historicalNotices = upstreamManifest.historical || [];
          }
          for (const historical of historicalNotices) {
            const notice = entry.historicalNotices?.find(n => n.sourceFile === historical.licenseFile);
            insist(notice && digest(await own(item, filePath(notice.file))) === historical.licenseSha256, 'Embedded historical license notice missing: ' + upstream.id);
          }
          insist(readme.includes(upstream.repository) && readme.includes(upstream.owner), 'README attribution missing: ' + upstream.id);
          const isOwnerUse = terms?.permission === 'personal-noncommercial' && item.rightsHolderLogin === policy.ownerDefaults?.ownerLogin
            && item.owner === upstream.owner && repository(item.repository).split('/')[0].toLowerCase() === policy.ownerDefaults?.ownerLogin;
          const freeUse = terms?.permission === 'personal-noncommercial' && ['personal-study', 'noncommercial-experiment', 'contribution'].includes(item.usageScope);
          if ((!terms || terms.permission === 'explicit-grant' || terms.permission === 'personal-noncommercial') && !isOwnerUse && !freeUse) {
            const grant = policy.grants.find(grant => grant.id === entry.grantId && grant.upstreamId === upstream.id
              && grant.repository === item.repository && grant.commit === (options.checkedCommit?.(item) || item.commit) && grant.rightsHolder === upstream.owner
              && grant.approvedBy === 'shwhwhwh' && grant.scopes?.includes('derive-and-redistribute')
              && (!['commercial', 'owner-maintained'].includes(item.usageScope) || grant.scopes.includes('commercial-use')));
            insist(grant && /^https:\/\/github\.com\//.test(grant.evidenceUrl), 'Maintainer-reviewed author grant required: ' + upstream.id);
          }
        }
        result.upstreamVersions = versions;
        insist(typeof item.license === 'string' && item.license.length > 0, 'Declare derivative terms without replacing upstream terms');
        insist((await own(item, 'LICENSE')).trim().length > 20, 'Derivative LICENSE is missing');
        await ownerPolicy(item);
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
  const live = await audit(registry, policy, read, snapshot, {
    ownRef: item => heads.get(repository(item.repository)), checkedCommit: item => heads.get(repository(item.repository))
  });
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
