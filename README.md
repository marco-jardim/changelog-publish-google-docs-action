# changelog-publish-google-docs-action

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![CI](https://github.com/marco-jardim/changelog-publish-google-docs-action/actions/workflows/ci.yml/badge.svg)](https://github.com/marco-jardim/changelog-publish-google-docs-action/actions/workflows/ci.yml)

> **Action 4/4** in the modular changelog pipeline — publishes a rendered markdown changelog to a Google Doc using the Docs API v1, with full idempotency support.

---

## Overview

`changelog-publish-google-docs-action` is the final step in a four-action changelog automation pipeline:

| Step | Action | Purpose |
|------|--------|---------|
| 1 | `changelog-collect-action` | Collects commits between two SHAs |
| 2 | `changelog-analyze-action` | Analyzes commits with AI, produces `insights.v1.json` |
| 3 | `changelog-render-action` | Renders markdown report (`executive-changelog.md`) |
| **4** | **`changelog-publish-google-docs-action`** | **Publishes to Google Docs** |

This action reads a markdown file and appends, prepends, or replaces a section in a Google Doc. It embeds an idempotency marker so re-runs on the same commit range are safely skipped.

---

## Features

- **Three insertion modes**: `append`, `prepend`, `replace_section`
- **Idempotency**: embeds a marker in the document; re-runs are automatically skipped
- **Markdown → Google Docs conversion**: headings H1–H4, bold, bullet lists, paragraphs, horizontal rules
- **Metadata enrichment**: optionally reads `insights.v1.json` and prepends a metadata block
- **Dry run**: logs all API requests that would be made, without touching the document
- **Security**: service account key is never logged at any verbosity level
- **Retry on 429**: single automatic retry on rate-limit errors

---

## Setting Up a Google Service Account

### 1. Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Give it a name (e.g. `changelog-publisher`) and click **Create and Continue**
4. Skip role assignment at the project level — click **Done**

### 2. Create and Download a Key

1. Click on the service account you just created
2. Go to the **Keys** tab → **Add Key** → **Create new key**
3. Choose **JSON** format → **Create**
4. A JSON file is downloaded — keep it safe

### 3. Enable the Google Docs API

1. Go to [APIs & Services](https://console.cloud.google.com/apis/library) → **Library**
2. Search for **Google Docs API** and **Enable** it

### 4. Share the Google Doc with the Service Account

1. Open your target Google Doc
2. Click **Share** (top-right)
3. Enter the service account's `client_email` (e.g. `changelog-publisher@my-project.iam.gserviceaccount.com`)
4. Set permission to **Editor**
5. Click **Send** (uncheck "Notify people" to avoid an email to the service account)

### 5. Encode the Key as Base64

```bash
# Linux/macOS
base64 -i service-account.json | tr -d '\n'

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
```

Store the base64 string as a GitHub Actions secret named `GDOCS_SERVICE_ACCOUNT_KEY`.

### 6. Get the Document ID

From the Google Doc URL:
```
https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                    This is the document_id
```

---

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `report_path` | ✅ | — | Path to the markdown report file (e.g. `executive-changelog.md`) |
| `document_id` | ✅ | — | Google Doc ID from the document URL |
| `service_account_key` | ✅ | — | Base64-encoded Service Account JSON key |
| `idempotency_key` | ❌ | `''` | String to deduplicate entries (e.g. `myrepo:abc123:def456`). If found in the doc, the action is skipped. |
| `insights_path` | ❌ | `''` | Path to `insights.v1.json` for metadata enrichment |
| `mode` | ❌ | `append` | `append`, `prepend`, or `replace_section` |
| `section_header` | ❌ | `''` | Header text to find and replace (required when `mode: replace_section`) |
| `dry_run` | ❌ | `false` | If `true`, logs what would be written without calling the API |

---

## Outputs

| Output | Description |
|--------|-------------|
| `document_url` | Full URL to the Google Doc (`https://docs.google.com/document/d/{id}/edit`) |
| `action_taken` | One of: `appended`, `prepended`, `replaced`, `skipped`, `dry_run`, `error` |
| `idempotency_hit` | `"true"` if the entry was skipped because the key was already found |

---

## Usage

### Standalone Usage

```yaml
name: Publish Changelog to Google Docs

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Render changelog
        # Assumes you have a markdown file ready
        run: echo "# Release ${{ github.ref_name }}" > executive-changelog.md

      - name: Publish to Google Docs
        id: publish
        uses: marco-jardim/changelog-publish-google-docs-action@v1
        with:
          report_path: executive-changelog.md
          document_id: ${{ secrets.GDOCS_DOCUMENT_ID }}
          service_account_key: ${{ secrets.GDOCS_SERVICE_ACCOUNT_KEY }}
          idempotency_key: ${{ github.repository }}:${{ github.sha }}
          mode: append

      - name: Show result
        run: |
          echo "Document URL: ${{ steps.publish.outputs.document_url }}"
          echo "Action taken: ${{ steps.publish.outputs.action_taken }}"
```

### Full Pipeline (All 4 Actions)

```yaml
name: Full Changelog Pipeline

on:
  push:
    branches: [main]

jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Collect commits
        id: collect
        uses: marco-jardim/changelog-collect-action@v1
        with:
          from_sha: ${{ github.event.before }}
          to_sha: ${{ github.sha }}

      - name: Analyze with AI
        id: analyze
        uses: marco-jardim/changelog-analyze-action@v1
        with:
          commits_path: ${{ steps.collect.outputs.commits_path }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}

      - name: Render markdown
        id: render
        uses: marco-jardim/changelog-render-action@v1
        with:
          insights_path: ${{ steps.analyze.outputs.insights_path }}

      - name: Publish to Google Docs
        id: publish
        uses: marco-jardim/changelog-publish-google-docs-action@v1
        with:
          report_path: ${{ steps.render.outputs.report_path }}
          document_id: ${{ secrets.GDOCS_DOCUMENT_ID }}
          service_account_key: ${{ secrets.GDOCS_SERVICE_ACCOUNT_KEY }}
          idempotency_key: ${{ github.repository }}:${{ github.event.before }}:${{ github.sha }}
          insights_path: ${{ steps.analyze.outputs.insights_path }}
          mode: append

      - name: Summary
        run: |
          echo "## Changelog Published 📄" >> $GITHUB_STEP_SUMMARY
          echo "- **URL**: ${{ steps.publish.outputs.document_url }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Action**: ${{ steps.publish.outputs.action_taken }}" >> $GITHUB_STEP_SUMMARY
```

### Dry Run Example

```yaml
- name: Preview Google Docs publish (dry run)
  uses: marco-jardim/changelog-publish-google-docs-action@v1
  with:
    report_path: executive-changelog.md
    document_id: ${{ secrets.GDOCS_DOCUMENT_ID }}
    service_account_key: ${{ secrets.GDOCS_SERVICE_ACCOUNT_KEY }}
    idempotency_key: ${{ github.sha }}
    dry_run: 'true'
```

### Replace Section Example

```yaml
- name: Replace the "Latest Release" section
  uses: marco-jardim/changelog-publish-google-docs-action@v1
  with:
    report_path: executive-changelog.md
    document_id: ${{ secrets.GDOCS_DOCUMENT_ID }}
    service_account_key: ${{ secrets.GDOCS_SERVICE_ACCOUNT_KEY }}
    mode: replace_section
    section_header: 'Latest Release'
```

---

## Idempotency Guide

Idempotency prevents duplicate entries when a workflow re-runs on the same commit range.

**How it works:**
1. Before writing, the action reads the full document text
2. It searches for the string `[idempotency:<your-key>]`
3. If found → sets `action_taken=skipped` and exits successfully without writing
4. If not found → proceeds to write, embedding the marker at the top of the inserted block

**Recommended key format:**
```
{repository}:{from_sha}:{to_sha}
```

Example: `myorg/myrepo:abc123def:456789ghi`

**In workflow:**
```yaml
idempotency_key: ${{ github.repository }}:${{ github.event.before }}:${{ github.sha }}
```

**Note:** If `idempotency_key` is empty, the check is skipped and every run appends to the document.

---

## Modes

### `append` (default)
Inserts content at the **end** of the document. A horizontal separator (`────`) is added before the new entry for visual clarity.

### `prepend`
Inserts content at the **beginning** of the document body (index 1). Useful for "most recent first" ordering.

### `replace_section`
Finds a section by its `section_header` text and **replaces** the entire section with the new content. If the header is not found, falls back to `append` mode with a warning.

```yaml
mode: replace_section
section_header: 'Latest Changes'
```

---

## Markdown → Google Docs Conversion

| Markdown | Google Docs Style |
|----------|-------------------|
| `# H1` | Heading 1 |
| `## H2` | Heading 2 |
| `### H3` | Heading 3 |
| `#### H4` | Heading 4 |
| `**bold**` or `__bold__` | Bold text |
| `- item` or `* item` | Bulleted list |
| `1. item` | Bulleted list |
| `---` | Horizontal rule (em-dashes) |
| Plain text | Normal text |

---

## Security Notes

- **Never log the service account key**: The key is decoded from base64 in memory and immediately passed to the Google Auth client. It is never printed, logged, or written to disk.
- **Use GitHub Secrets**: Always store `service_account_key` as a GitHub Actions secret — never hardcode it in workflow YAML.
- **Minimal scope**: The service account only needs `https://www.googleapis.com/auth/documents` scope. Do not grant broader permissions.
- **Principle of least privilege**: Only share the specific Google Doc with the service account as Editor — do not share your entire Drive.
- **Base64 encoding**: The key is base64-encoded to safely pass it as an environment variable. This is obfuscation, not encryption — always use GitHub Secrets.

---

## inputs.v1.json Schema (insights enrichment)

When `insights_path` points to a valid `insights.v1.json`, the action prepends a **Metadata** section:

```json
{
  "repository": "org/repo",
  "generated_at": "2024-01-15T10:00:00Z",
  "from_sha": "abc123",
  "to_sha": "def456",
  "total_commits": 42,
  "contributors": ["alice", "bob"],
  "file_changes": {
    "added": 5,
    "modified": 10,
    "deleted": 2
  }
}
```

All fields are optional. Missing fields are simply omitted from the metadata block.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Run `npm test` to ensure all tests pass
5. Run `npm run build` to build the distribution bundle
6. Commit the `dist/` directory along with your changes
7. Open a pull request

### Development Setup

```bash
git clone https://github.com/marco-jardim/changelog-publish-google-docs-action.git
cd changelog-publish-google-docs-action
npm install
npm test          # Run tests
npm run build     # Build dist/index.js
```

### Testing

```bash
npm test               # All tests (69 tests across 5 suites)
npm run test:coverage  # With coverage report
npm run typecheck      # TypeScript type checking only
```

---

## License

[GNU General Public License v3.0](LICENSE) © Marco Jardim
