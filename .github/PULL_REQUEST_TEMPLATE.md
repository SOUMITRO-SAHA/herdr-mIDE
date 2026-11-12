<!-- Every PR needs an issue: link it with a closing keyword (see CONTRIBUTING.md). -->

Fixes #

## What and why

What changes, and why it matters to the people using herdr-mIDE.

## Claim

- [ ] I commented `/claim` on the linked issue **before** starting work and I
      am its claimant (or the maintainer approved a takeover on the issue).

## Verification

- [ ] Branch follows `<type>/<issue-number>-<slug>`; commits follow `type(scope): summary`
- [ ] `just fmt-check` clean (run `just fmt` if not)
- [ ] `just test` green
- [ ] `just check` green (required when mods changed; tick N/A in the notes otherwise)
- [ ] Failing test added first for behavior changes (TDD per AGENTS.md)
- [ ] Live verification ran in the `herdr-dev` profile only — or is noted as not done
- [ ] `CHANGELOG.md` (Unreleased) updated for user-facing changes
- [ ] `RECIPE.md` / `THIRD-PARTY-NOTICES.md` updated if behavior, assets or credits changed

## Notes for reviewers

What could not be verified automatically; screenshots; follow-ups.
