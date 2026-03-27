import { Auth } from 'googleapis';
import type { docs_v1 } from 'googleapis';
import type { DocsRequest, DocContent } from './types';
/**
 * Creates and returns a Google Docs API v1 client.
 */
export declare function createDocsClient(auth: Auth.GoogleAuth): docs_v1.Docs;
/**
 * Retrieves the full document for section-based operations.
 */
export declare function getFullDocument(docsClient: docs_v1.Docs, documentId: string): Promise<docs_v1.Schema$Document>;
/**
 * Executes a batchUpdate request against the Google Docs API.
 * Handles rate limiting with a single retry on 429.
 */
export declare function executeBatchUpdate(docsClient: docs_v1.Docs, documentId: string, requests: DocsRequest[]): Promise<void>;
/**
 * Logs all requests that would be sent to the API (dry run mode).
 */
export declare function logDryRunRequests(requests: DocsRequest[], insertIndex: number): void;
/**
 * Builds the insert index for "append" mode (end of document).
 */
export declare function getAppendIndex(docContent: DocContent): number;
/**
 * Builds the insert index for "prepend" mode (beginning of document body, after index 1).
 */
export declare function getPrependIndex(): number;
/**
 * Builds delete + insert requests for replace_section mode.
 */
export declare function buildReplaceSectionRequests(deleteRange: {
    startIndex: number;
    endIndex: number;
}, insertRequests: DocsRequest[]): DocsRequest[];
