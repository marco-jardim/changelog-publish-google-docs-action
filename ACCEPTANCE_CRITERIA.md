# Acceptance Criteria

## AC-1: Inputs & Configuration

- [ ] `report_path` input is required; action fails with clear error if file does not exist
- [ ] `document_id` input is required; action validates it is a valid Google Doc ID format
- [ ] `service_account_key` input is required; action fails with clear error if empty
- [ ] `idempotency_key` input is optional; empty string disables idempotency check
- [ ] `insights_path` input is optional; missing file produces a warning, not a failure
- [ ] `mode` input accepts `append`, `prepend`, `replace_section`; invalid value causes error
- [ ] `section_header` is required when `mode=replace_section`; missing causes error
- [ ] `dry_run` input accepts `true`/`false`; defaults to `false`

## AC-2: Authentication

- [ ] Service account key is decoded from base64 to JSON without logging key content
- [ ] GoogleAuth client is created with `https://www.googleapis.com/auth/documents` scope only
- [ ] 403 errors produce a human-readable message about Editor permission
- [ ] 404 errors produce a human-readable message about invalid document ID
- [ ] Service account key is never logged at any log level (debug, info, warning, error)

## AC-3: Idempotency

- [ ] Before writing, the action reads the current document text
- [ ] If `idempotency_key` is provided and found in the document, `action_taken=skipped` is set
- [ ] If `idempotency_key` is provided and NOT found, the action proceeds to write
- [ ] The idempotency marker `[idempotency:<key>]` is embedded at the top of each inserted block
- [ ] Re-running the action with the same `idempotency_key` does not duplicate content
- [ ] `idempotency_hit` output is `"true"` only when content was skipped

## AC-4: Append Mode

- [ ] Content is inserted at the end of the document
- [ ] A horizontal separator is inserted before the new entry
- [ ] All markdown elements are converted to Google Docs format
- [ ] `action_taken` output is `"appended"` on success

## AC-5: Prepend Mode

- [ ] Content is inserted at the beginning of the document body (index 1)
- [ ] All markdown elements are converted to Google Docs format
- [ ] `action_taken` output is `"prepended"` on success

## AC-6: Replace Section Mode

- [ ] The action finds the section by exact header text match (case-insensitive)
- [ ] The existing section content is deleted and replaced with new content
- [ ] If the header is not found, the action falls back to append with a warning
- [ ] `action_taken` output is `"replaced"` on success

## AC-7: Markdown Conversion

- [ ] `# H1` → HEADING_1 style
- [ ] `## H2` → HEADING_2 style
- [ ] `### H3` → HEADING_3 style
- [ ] `#### H4` → HEADING_4 style
- [ ] `**bold**` and `__bold__` → bold text style applied to the range
- [ ] `- item`, `* item`, `+ item` → bulleted list (BULLET_DISC_CIRCLE_SQUARE)
- [ ] `1. item` → bulleted list
- [ ] `---` → horizontal rule text
- [ ] Plain text → NORMAL_TEXT paragraph
- [ ] Blank lines → newline separators

## AC-8: Insights Enrichment

- [ ] When `insights_path` is provided, a `## Metadata` block is prepended to the content
- [ ] Metadata includes: repository, generated_at, commit range, total_commits, contributors, file_changes
- [ ] Missing fields in insights JSON are gracefully omitted (no `undefined` values)
- [ ] Invalid JSON in insights file produces a warning, not a failure

## AC-9: Dry Run

- [ ] When `dry_run=true`, no Google Docs API write calls are made
- [ ] All requests that would be made are logged to stdout
- [ ] `action_taken` output is `"dry_run"`
- [ ] Document read is still performed for idempotency check (or skipped in dry run)

## AC-10: Outputs

- [ ] `document_url` is always set to the Google Doc URL (even on error)
- [ ] `action_taken` is always set to one of the defined values
- [ ] `idempotency_hit` is always set to `"true"` or `"false"`

## AC-11: Error Handling

- [ ] All errors call `core.setFailed()` with a descriptive message
- [ ] `action_taken` is set to `"error"` on failure
- [ ] Action never crashes with an unhandled exception

## AC-12: Tests

- [ ] At least 12 Jest tests covering all major paths
- [ ] Auth tests: base64 decode, validation, URL building
- [ ] Idempotency tests: key found, key not found, empty key
- [ ] Markdown tests: all element types, bold ranges, batch requests
- [ ] Integration tests: append, dry_run, skipped, error paths
- [ ] All tests pass with `npm test`

## AC-13: Build & Distribution

- [ ] `npm run build` compiles TypeScript and produces `dist/index.js`
- [ ] `dist/index.js` is committed to the repository
- [ ] `action.yml` references `node20` runtime with `dist/index.js` as entrypoint
- [ ] No TypeScript errors (`npm run typecheck` passes)

## AC-14: Documentation

- [ ] `README.md` includes overview, setup guide, inputs/outputs table, usage examples
- [ ] Service Account creation and sharing instructions are documented
- [ ] Security notes are included
- [ ] GPL-3.0 license badge in README
- [ ] `LICENSE` file contains full GPL-3.0 text

## AC-15: CI/CD

- [ ] `.github/workflows/ci.yml` runs tests and build on push and PR
- [ ] GitHub repo is public at `marco-jardim/changelog-publish-google-docs-action`
- [ ] Release `v1.0.0` is tagged and published on GitHub
