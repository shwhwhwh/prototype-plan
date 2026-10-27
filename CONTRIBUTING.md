# Sharing and improving prototypes

Prototype Plan connects ideas, runnable evidence and independent project repositories.

## Propose a prototype

Open the Prototype submission issue and include:

1. The problem, intended users, and the smallest useful demonstration.
2. A dedicated repository, author attribution, license and AI-assistance disclosure.
3. Reproducible installation or a demonstration using data you can publish.
4. What works today, known limits, and what needs engineering next.

Ideas may be discussed before a runnable prototype exists; label their state clearly.
Maintainers review submissions before adding a project to the catalog. A submission
does not transfer its ownership, imply endorsement, or automatically grant a license.

## Improve an existing project

Read the dedicated repository's license first. New RN/BC original material is reserved with free personal study and noncommercial experiments; commercial permission is separate. Historical RN MIT material keeps its MIT permissions. Read RIGHTS_POLICY.md and each recorded source license.
Send implementation changes to the project's own repository. Use this catalog for
discovery, cross-project ideas and updates to the pinned version.

## Record a reviewed version

Update both the Git submodule pointer and projects.json. Explain which behavior
changed and how it was checked. Do not use a project's successful demo as evidence
that production reliability, security or scalability has been established.

Keep credentials, private conversations, account state, proprietary data and generated
runtime storage out of submissions. Authors remain responsible for the material they
choose to make public.

## Register derived projects

Use the derivative issue form and follow [rights/README.md](rights/README.md). Add an immutable commit and parentId to projects.json only after provenance files exist in the derived repository. Required CI must pass; restricted-use permissions need maintainer-reviewed evidence, not self-attestation. The tree renders passed records only. License and copyright notices apply independently to every ancestor.

## Deliberate new contributions

Read CONTRIBUTOR_AGREEMENT.md. If you agree and have authority, expressly include `CLA-ACCEPTED: PP-CLA-1.0` in your PR description. Contributors retain attribution and ownership; the maintainer receives the stated maintenance, publication and commercial sublicensing grant for accepted original contributions. Incidental discussion grants nothing; separate terms may be requested.
