// SPDX-License-Identifier: GPL-3.0

import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import type { ActionInputs, ActionOutputs, ActionTaken, InsightsData } from './types';
import {
  decodeServiceAccountKey,
  createGoogleAuth,
  validateDocumentId,
  buildDocumentUrl,
} from './auth';
import {
  parseMarkdown,
  segmentsToBatchRequests,
  enrichWithInsights,
} from './markdown';
import {
  getDocumentContent,
  checkIdempotency,
  findSectionIndex,
  findSectionEndIndex,
} from './idempotency';
import {
  createDocsClient,
  getFullDocument,
  executeBatchUpdate,
  logDryRunRequests,
  getAppendIndex,
  getPrependIndex,
  buildReplaceSectionRequests,
} from './docs';

/**
 * Reads and validates all action inputs.
 */
function readInputs(): ActionInputs {
  const reportPath = core.getInput('report_path', { required: true });
  const documentId = core.getInput('document_id', { required: true });
  const serviceAccountKey = core.getInput('service_account_key', { required: true });
  const idempotencyKey = core.getInput('idempotency_key') ?? '';
  const insightsPath = core.getInput('insights_path') ?? '';
  const modeRaw = core.getInput('mode') || 'append';
  const sectionHeader = core.getInput('section_header') ?? '';
  const dryRunRaw = core.getInput('dry_run') || 'false';

  const validModes = ['append', 'prepend', 'replace_section'];
  if (!validModes.includes(modeRaw)) {
    throw new Error(`Invalid mode "${modeRaw}". Must be one of: ${validModes.join(', ')}`);
  }

  if (modeRaw === 'replace_section' && !sectionHeader) {
    throw new Error('section_header is required when mode is "replace_section"');
  }

  const dryRun = dryRunRaw.toLowerCase() === 'true';

  return {
    reportPath,
    documentId: documentId.trim(),
    serviceAccountKey,
    idempotencyKey: idempotencyKey.trim(),
    insightsPath: insightsPath.trim(),
    mode: modeRaw as ActionInputs['mode'],
    sectionHeader: sectionHeader.trim(),
    dryRun,
  };
}

/**
 * Reads and validates the markdown report file.
 */
function readReportFile(reportPath: string): string {
  const resolvedPath = path.resolve(reportPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`report_path "${reportPath}" does not exist`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf8');
  if (!content.trim()) {
    throw new Error(`report_path "${reportPath}" is empty`);
  }

  core.debug(`Read ${content.length} characters from ${reportPath}`);
  return content;
}

/**
 * Optionally reads insights.v1.json for metadata enrichment.
 */
function readInsights(insightsPath: string): InsightsData | null {
  if (!insightsPath) return null;

  const resolvedPath = path.resolve(insightsPath);
  if (!fs.existsSync(resolvedPath)) {
    core.warning(`insights_path "${insightsPath}" does not exist, skipping metadata enrichment`);
    return null;
  }

  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const data = JSON.parse(raw) as InsightsData;
    core.debug('Loaded insights.v1.json for metadata enrichment');
    return data;
  } catch {
    core.warning(`Failed to parse insights_path "${insightsPath}" as JSON, skipping`);
    return null;
  }
}

/**
 * Main action entrypoint.
 */
export async function run(): Promise<ActionOutputs> {
  let actionTaken: ActionTaken = 'error';
  let documentUrl = '';
  let idempotencyHit = false;

  try {
    // 1. Read inputs
    const inputs = readInputs();
    core.setSecret(inputs.serviceAccountKey);

    // 2. Validate document ID
    validateDocumentId(inputs.documentId);

    documentUrl = buildDocumentUrl(inputs.documentId);
    core.debug(`Target document: ${documentUrl}`);

    // 3. Read report
    let markdownContent = readReportFile(inputs.reportPath);

    // 4. Optionally enrich with insights
    const insights = readInsights(inputs.insightsPath);
    if (insights) {
      markdownContent = enrichWithInsights(markdownContent, insights);
      core.info('Enriched content with insights metadata');
    }

    // 5. Set up Google Auth (never log credentials)
    const credentials = decodeServiceAccountKey(inputs.serviceAccountKey);
    const auth = createGoogleAuth(credentials);
    const docsClient = createDocsClient(auth);

    // 6. Read current document content for idempotency check
    const docContent = await getDocumentContent(docsClient, inputs.documentId);

    // 7. Idempotency check
    if (inputs.idempotencyKey) {
      const alreadyPresent = checkIdempotency(docContent.plainText, inputs.idempotencyKey);
      if (alreadyPresent) {
        idempotencyHit = true;
        actionTaken = 'skipped';
        core.info(`Skipped: idempotency key "${inputs.idempotencyKey}" already present`);

        core.setOutput('document_url', documentUrl);
        core.setOutput('action_taken', actionTaken);
        core.setOutput('idempotency_hit', String(idempotencyHit));

        return { documentUrl, actionTaken, idempotencyHit };
      }
    }

    // 8. Dry run mode
    if (inputs.dryRun) {
      const segments = parseMarkdown(markdownContent);
      const insertIndex = inputs.mode === 'prepend' ? getPrependIndex() : getAppendIndex(docContent);
      const { requests } = segmentsToBatchRequests(segments, insertIndex, inputs.idempotencyKey);

      logDryRunRequests(requests, insertIndex);

      actionTaken = 'dry_run';
      core.info('[DRY RUN] No changes were made to the document');

      core.setOutput('document_url', documentUrl);
      core.setOutput('action_taken', actionTaken);
      core.setOutput('idempotency_hit', 'false');

      return { documentUrl, actionTaken, idempotencyHit: false };
    }

    // 9. Build requests and execute
    const segments = parseMarkdown(markdownContent);

    if (inputs.mode === 'append') {
      const insertIndex = getAppendIndex(docContent);
      const { requests } = segmentsToBatchRequests(segments, insertIndex, inputs.idempotencyKey);

      // Prepend a separator before the new entry
      const separatorRequests = buildSeparatorRequests(insertIndex);
      const allRequests = [...separatorRequests, ...requests];

      await executeBatchUpdate(docsClient, inputs.documentId, allRequests);
      actionTaken = 'appended';
      core.info(`Successfully appended content to document`);

    } else if (inputs.mode === 'prepend') {
      const insertIndex = getPrependIndex();
      const { requests } = segmentsToBatchRequests(segments, insertIndex, inputs.idempotencyKey);
      await executeBatchUpdate(docsClient, inputs.documentId, requests);
      actionTaken = 'prepended';
      core.info(`Successfully prepended content to document`);

    } else if (inputs.mode === 'replace_section') {
      const fullDoc = await getFullDocument(docsClient, inputs.documentId);
      const sectionStart = findSectionIndex(fullDoc, inputs.sectionHeader);

      if (sectionStart === -1) {
        core.warning(
          `Section header "${inputs.sectionHeader}" not found in document. ` +
            'Falling back to append mode.'
        );
        const insertIndex = getAppendIndex(docContent);
        const { requests } = segmentsToBatchRequests(
          segments,
          insertIndex,
          inputs.idempotencyKey
        );
        await executeBatchUpdate(docsClient, inputs.documentId, requests);
        actionTaken = 'appended';
      } else {
        const sectionEnd = findSectionEndIndex(fullDoc, sectionStart);
        const { requests: insertRequests } = segmentsToBatchRequests(
          segments,
          sectionStart,
          inputs.idempotencyKey
        );
        const allRequests = buildReplaceSectionRequests(
          { startIndex: sectionStart, endIndex: sectionEnd },
          insertRequests
        );
        await executeBatchUpdate(docsClient, inputs.documentId, allRequests);
        actionTaken = 'replaced';
        core.info(`Successfully replaced section "${inputs.sectionHeader}" in document`);
      }
    }

    core.setOutput('document_url', documentUrl);
    core.setOutput('action_taken', actionTaken);
    core.setOutput('idempotency_hit', String(idempotencyHit));

    return { documentUrl, actionTaken, idempotencyHit };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    core.setFailed(`changelog-publish-google-docs-action failed: ${message}`);

    core.setOutput('document_url', documentUrl);
    core.setOutput('action_taken', 'error');
    core.setOutput('idempotency_hit', 'false');

    return { documentUrl, actionTaken: 'error', idempotencyHit: false };
  }
}

/**
 * Builds separator requests to insert a horizontal rule before a new entry.
 */
function buildSeparatorRequests(insertIndex: number): import('./types').DocsRequest[] {
  const separatorText = '\n────────────────────────────────────\n';
  return [
    {
      insertText: {
        text: separatorText,
        location: { index: insertIndex },
      },
    },
  ];
}

// Run the action
run();
