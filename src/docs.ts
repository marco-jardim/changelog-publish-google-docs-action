// SPDX-License-Identifier: GPL-3.0

import * as core from '@actions/core';
import { google, Auth } from 'googleapis';
import type { docs_v1 } from 'googleapis';
import type { DocsRequest, DocContent } from './types';

/**
 * Creates and returns a Google Docs API v1 client.
 */
export function createDocsClient(auth: Auth.GoogleAuth): docs_v1.Docs {
  return google.docs({ version: 'v1', auth });
}

/**
 * Retrieves the full document for section-based operations.
 */
export async function getFullDocument(
  docsClient: docs_v1.Docs,
  documentId: string
): Promise<docs_v1.Schema$Document> {
  const response = await docsClient.documents.get({ documentId });
  return response.data;
}

/**
 * Executes a batchUpdate request against the Google Docs API.
 * Handles rate limiting with a single retry on 429.
 */
export async function executeBatchUpdate(
  docsClient: docs_v1.Docs,
  documentId: string,
  requests: DocsRequest[]
): Promise<void> {
  if (requests.length === 0) {
    core.debug('No requests to execute in batchUpdate');
    return;
  }

  core.debug(`Executing batchUpdate with ${requests.length} requests`);

  try {
    await docsClient.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
  } catch (err: unknown) {
    const error = err as { code?: number; message?: string };

    if (error.code === 429) {
      core.warning('Rate limit hit (429), retrying after 5 seconds...');
      await sleep(5000);
      await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests },
      });
    } else if (error.code === 403) {
      throw new Error(
        `Permission denied (403) accessing document "${documentId}". ` +
          'Ensure the Service Account has Editor access to the document.'
      );
    } else if (error.code === 404) {
      throw new Error(
        `Document "${documentId}" not found (404). ` +
          'Verify the document_id is correct and the document exists.'
      );
    } else {
      throw new Error(
        `Google Docs API error: ${error.message ?? String(err)}`
      );
    }
  }
}

/**
 * Logs all requests that would be sent to the API (dry run mode).
 */
export function logDryRunRequests(requests: DocsRequest[], insertIndex: number): void {
  core.info(`[DRY RUN] Would execute batchUpdate with ${requests.length} requests at index ${insertIndex}`);
  core.info('[DRY RUN] Request summary:');

  let textInserted = 0;
  let styleChanges = 0;
  let bulletChanges = 0;

  for (const req of requests) {
    if (req.insertText) {
      textInserted++;
      const preview = req.insertText.text.substring(0, 60).replace(/\n/g, '\\n');
      core.info(`  [DRY RUN] insertText at ${req.insertText.location.index}: "${preview}"`);
    } else if (req.updateParagraphStyle) {
      styleChanges++;
    } else if (req.updateTextStyle) {
      styleChanges++;
    } else if (req.createParagraphBullets) {
      bulletChanges++;
    } else if (req.deleteContentRange) {
      core.info(`  [DRY RUN] deleteContentRange: ${JSON.stringify(req.deleteContentRange.range)}`);
    }
  }

  if (styleChanges > 0) {
    core.info(`  [DRY RUN] ${styleChanges} style update(s)`);
  }
  if (bulletChanges > 0) {
    core.info(`  [DRY RUN] ${bulletChanges} bullet format(s)`);
  }
  core.info(`[DRY RUN] Total text insertions: ${textInserted}`);
}

/**
 * Builds the insert index for "append" mode (end of document).
 */
export function getAppendIndex(docContent: DocContent): number {
  return docContent.endIndex;
}

/**
 * Builds the insert index for "prepend" mode (beginning of document body, after index 1).
 */
export function getPrependIndex(): number {
  // Index 1 is the start of the body in Google Docs
  return 1;
}

/**
 * Builds delete + insert requests for replace_section mode.
 */
export function buildReplaceSectionRequests(
  deleteRange: { startIndex: number; endIndex: number },
  insertRequests: DocsRequest[]
): DocsRequest[] {
  const deleteRequest: DocsRequest = {
    deleteContentRange: {
      range: {
        startIndex: deleteRange.startIndex,
        endIndex: deleteRange.endIndex,
      },
    },
  };

  // Delete first, then insert at the start of the deleted range
  return [deleteRequest, ...insertRequests];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
