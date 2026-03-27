import type { docs_v1 } from 'googleapis';
import type { DocContent } from './types';
/**
 * Reads the current document content and returns the plain text and end index.
 */
export declare function getDocumentContent(docsClient: docs_v1.Docs, documentId: string): Promise<DocContent>;
/**
 * Checks if the idempotency key is already present in the document text.
 * Returns true if the key was found (action should be skipped).
 */
export declare function checkIdempotency(plainText: string, idempotencyKey: string): boolean;
/**
 * Finds the index in the document where a section starts (by header text).
 * Returns -1 if the section header is not found.
 */
export declare function findSectionIndex(doc: docs_v1.Schema$Document, sectionHeader: string): number;
/**
 * Finds the end index of a section (from its start until the next heading at same or higher level).
 * Used for replace_section mode.
 */
export declare function findSectionEndIndex(doc: docs_v1.Schema$Document, sectionStartIndex: number): number;
