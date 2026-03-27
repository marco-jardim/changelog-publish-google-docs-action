import { Auth } from 'googleapis';
import type { ServiceAccountCredentials } from './types';
/**
 * Decodes a base64-encoded Service Account JSON key.
 * Never logs the key content.
 */
export declare function decodeServiceAccountKey(base64Key: string): ServiceAccountCredentials;
/**
 * Creates a GoogleAuth client with Google Docs API scope.
 * The credentials object is never serialized or logged.
 */
export declare function createGoogleAuth(credentials: ServiceAccountCredentials): Auth.GoogleAuth;
/**
 * Validates the document ID format (basic sanity check).
 * Google Doc IDs are typically 44-character alphanumeric strings with hyphens and underscores.
 */
export declare function validateDocumentId(documentId: string): void;
/**
 * Builds the full URL for a Google Doc.
 */
export declare function buildDocumentUrl(documentId: string): string;
