# Definition of Done

A task or feature is considered **done** when ALL of the following are true:

## Code Quality

- [ ] TypeScript source compiles with zero errors (`npm run typecheck`)
- [ ] No `as any`, `@ts-ignore`, or `@ts-expect-error` anywhere in `src/` or `tests/`
- [ ] No empty catch blocks; all errors are re-thrown or logged meaningfully
- [ ] All functions have a clear single responsibility
- [ ] No hardcoded secrets, credentials, or document IDs

## Testing

- [ ] All 69+ Jest tests pass (`npm test`)
- [ ] New code has corresponding test coverage
- [ ] Integration tests cover the new code path
- [ ] Tests use mocks for all external API calls (Google Docs, filesystem where appropriate)
- [ ] No tests deleted or skipped to make the suite pass

## Build

- [ ] `npm run build` exits with code 0
- [ ] `dist/index.js` is present and up-to-date with source changes
- [ ] `dist/` is committed alongside the source changes (required for GitHub Actions)

## Documentation

- [ ] `README.md` reflects any new inputs, outputs, or behavior changes
- [ ] Inputs/outputs table is up to date in `README.md`
- [ ] `ACCEPTANCE_CRITERIA.md` checkboxes are verified
- [ ] Code has inline comments for non-obvious logic

## Security

- [ ] Service account key is never logged at any verbosity level
- [ ] No new secrets introduced in plain text
- [ ] New inputs with sensitive values are marked for masking

## GitHub

- [ ] Changes are on a feature branch (not committed directly to `main`)
- [ ] Pull request created with a clear description
- [ ] CI workflow passes on the pull request
- [ ] PR reviewed and approved before merge
- [ ] `dist/` included in the PR diff

## Release (for version bumps)

- [ ] `package.json` version bumped following semver
- [ ] Git tag created matching the version (`vX.Y.Z`)
- [ ] GitHub Release published with release notes
- [ ] Major version tag updated (e.g., `v1` → latest `v1.x.x`)
