# Provenance and rights checks

This is a catalog admission policy and evidence trail, not DRM or legal certification.
It cannot prevent copying outside this catalog, detect every reupload, or transfer
ownership of original or new work. An unregistered fork is not automatically an infringement.

## What the gate checks

- A unique GitHub repository and full immutable commit SHA for every registered node.
- An acyclic parent chain terminating at an approved original in `rights/policy.json`.
- Original authors, licenses and source commit anchors cannot be replaced by a submission.
- Every derived repository must include `PROTOTYPE_ORIGIN.json`, link and credit every
  ancestor in its README, and preserve the complete upstream LICENSE text in the stated files.
- RN retains MIT. A derivative may use different terms for its own contributions; the
  original MIT notice remains. This catalog does not convert MIT into a share-alike license.
- BC retains all rights reserved. A derivative needs a **maintainer-reviewed author grant**
  for the exact repository and source commit. A checkbox, guessed permission or copied
  license file is insufficient. `grants` is initially empty; no permission is implied.
- Other intermediate derivatives require a reviewed grant for onward use until a maintainer
  explicitly reviews their licensing. All upstream obligations still apply.

## Register a derivative

1. Read the actual parent license; obtain permission when required, before reusing code.
2. Copy `templates/PROTOTYPE_ORIGIN.json` to your repository root. Fill its real identity,
   parent and **all** upstream ancestors; preserve original ownership, commits and license files.
3. In README, credit each upstream owner and link each upstream repository. State the
   changes you authored. Include a LICENSE covering your contributions without replacing
   upstream terms. Never publish private permission correspondence without consent.
4. Submit a derivative issue, then propose an entry in `projects.json` with `parentId`,
   `originFile: "PROTOTYPE_ORIGIN.json"` and the immutable commit containing these files.
5. A rights holder / maintainer reviews any restricted authorization. Only then may the
   maintainer add a grant record: `id`, `upstreamId`, `repository`, `commit`, `rightsHolder`,
   `approvedBy`, `scopes: ["derive-and-redistribute"]`, `evidenceUrl` (public authorized evidence).
6. CI reads files via GitHub's API; it never runs submitted repository code. Failed or
   unverified descendants are excluded from the published tree. The site records the check time.

Run locally with Node 24: `node --test scripts/lineage-policy.test.mjs`, then
`node scripts/lineage-policy.mjs --output public/lineage.json`. Public API rate limits apply;
CI uses a read-only GitHub token. A network error blocks admission, never grants permission.

PR checks use the **base commit's** checker and policy, not a contributor's modified code.
CODEOWNERS and protected-main reviews guard changes to policy/grants/checker; the repository
owner can administratively bypass controls. These are workflow safeguards, not irrevocable restrictions.

The read-only workflow audits the registry daily and on manual dispatch. The website reads
the latest completed main-branch run and its exact registry version; only successful checks
are used for live descendants. If a newer check fails or is unavailable/stale, descendants
are withheld and the site shows its dated original-project snapshot. CI has no main-branch
write permission. No third-party files are auto-modified, and no infringement allegations
or notices are automatically sent.

Sources: [GitHub licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository),
[MIT terms](https://choosealicense.com/licenses/mit/).

## Installation status

The checker and reviewed original snapshot are available. GitHub rejected workflow upload because the current OAuth login lacks the `workflow` scope. The **inactive** workflow is at `templates/ci/lineage.yml`; it is not running yet. After the owner authorizes installation, copy it to `.github/workflows/lineage.yml`, push, confirm a successful run, and enable the required `lineage-policy` status plus CODEOWNERS review on main. Until then the site shows only dated original snapshots and withholds live descendants. No scheduled CI or protected admission gate is claimed active.
