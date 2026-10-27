# Provenance and versioned rights checks

This is a catalog admission safeguard, not DRM, ownership certification or a legal judgment. It cannot stop outside copying, find all reuploads or transfer anyone's rights.

## New owner default and prior grants

All owner-controlled material in Rui Li's official distributions, including earlier self-owned code, uses **LicenseRef-Prototype-Plan-Personal-Noncommercial-1.1**: all rights reserved with free personal study, noncommercial experiments and voluntary contribution work; commercial use needs separate written authorization. New owner-controlled prototypes and owner-built derivatives must keep this policy, LICENSING.json and the canonical commercial/contribution terms. Other authors retain their rights.

RN's historical MIT code, including the recorded 45ce4b4 boundary and v0.3.0 release, keeps its MIT commercial permissions. BC's old v0.1.0 retains its original package terms. Immutable historical snapshots are in rights/history/. The current distribution offer is distinct from valid rights already obtained under historical grants; prior rights are not revoked. New material outside those grants is not licensed under MIT by an archived notice.

## Registration

Every project has a unique public GitHub repository and immutable 40-character commit. Derived projects record parentId, optional parentCommit for a reviewed historical source, originFile and explicit usageScope in projects.json. PROTOTYPE_ORIGIN.json must match that source and use scope, list **all** ancestor versions, preserve their complete license notices, and credit authors/repositories in README. Ancestors cannot be silently substituted.

Use scopes: personal-study, noncommercial-experiment, contribution, commercial, owner-maintained. Under the new limited-use policy the first three are free; commercial use needs a maintainer-reviewed grant bound to the derivative repository and checked commit. The rights holder does not need to license their own original work to themselves. This exception does not cover another author's work. Unknown intermediate licenses require separate review. A historical MIT ancestor is checked under its MIT terms, including free commercial rights, not under the owner's later restrictions.

An explicit grant record contains id, upstreamId, repository, commit, rightsHolder, approvedBy, scopes including derive-and-redistribute (and commercial-use for commercial/owner-maintained use), and public authorized evidenceUrl. Do not expose private permission correspondence; arrange suitable public evidence with the parties. A checkbox or inferred permission is not such a grant.

## Collaboration

New deliberate external code/documentation contributions require express PP-CLA-1.0 attestation or separately agreed terms. Contributors retain ownership and credit, granting the maintainer nonexclusive rights to maintain, publish and commercially sublicense accepted contributions. Existing contributions are not retroactively covered. Automated attestation is evidence of a statement, not proof of legal authority. CODEOWNERS review remains required.

## Operation

The read-only workflows run on push, PR, manual dispatch and daily schedule (lineage). PRs use the base commit's checker/policy, never submitted executable code. Only public repository files are read. Both registered source and default-branch attribution files are checked; upstream historic licenses are always read at their **recorded** commits. Network failures block admission. Current source scope narrowing (for example to new additions only), false prior-grant/third-party safeguards, notice removal and changed historical archives fail checks. The exact policy 1.0 text remains a trusted historical snapshot; its old source commits never inherit the current 1.1 hash.

Main requires lineage-policy from GitHub Actions and CODEOWNERS approval; the owner retains administrative bypass. The website reads the latest completed successful main run and its exact index. Failures, unavailable results or results older than 50 hours hide descendants and show a dated original snapshot. No scheduled writes, automatic allegations or external repository modifications occur.

Run: `node --test scripts/lineage-policy.test.mjs`, then `node scripts/lineage-policy.mjs --output public/lineage.json`. New roots and new historic source variants need owner-reviewed anchors in policy.json before ordinary admission. See [RIGHTS_POLICY.md](../RIGHTS_POLICY.md).

For current-source ancestors that bundle historical licenses, also provide `historicalNotices` in each upstream record, mapping `sourceFile` to the preserved downstream `file`. The checker verifies those archived notices separately; preserving only the new top-level LICENSE cannot remove historical MIT permissions/notices.
