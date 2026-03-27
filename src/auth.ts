// SPDX-License-Identifier: GPL-3.0

import * as core from '@actions/core';
import { google, Auth } from 'googleapis';
import type { ServiceAccountCredentials } from './types';

/**
 * Decodes a base64-encoded Service Account JSON key.
 * Never logs the key content.
 */
export function decodeServiceAccountKey(base64Key: string): ServiceAccountCredentials {
  if (!base64Key || base64Key.trim() === '') {
    throw new Error('service_account_key is required but was not provided');
  }

  let jsonString: string;
  try {
    jsonString = Buffer.from(base64Key.trim(), 'base64').toString('utf8');
  } catch {
    throw new Error('Failed to decode service_account_key from base64');
  }

  let credentials: unknown;
  try {
    credentials = JSON.parse(jsonString);
  } catch {
    throw new Error('service_account_key is not valid JSON after base64 decoding');
  }

  const creds = credentials as Record<string, unknown>;
  const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
  const missingFields = requiredFields.filter((f) => !creds[f]);

  if (missingFields.length > 0) {
    throw new Error(
      `service_account_key is missing required fields: ${missingFields.join(', ')}`
    );
  }

  if (creds['type'] !== 'service_account') {
    throw new Error(
      `service_account_key must have type "service_account", got "${String(creds['type'])}"`
    );
  }

  core.debug('Service account key decoded successfully');
  core.debug(`Using service account: ${String(creds['client_email'])}`);

  return credentials as ServiceAccountCredentials;
}

/**
 * Creates a GoogleAuth client with Google Docs API scope.
 * The credentials object is never serialized or logged.
 */
export function createGoogleAuth(credentials: ServiceAccountCredentials): Auth.GoogleAuth {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/documents'],
  });

  return auth;
}

/**
 * Validates the document ID format (basic sanity check).
 * Google Doc IDs are typically 44-character alphanumeric strings with hyphens and underscores.
 */
export function validateDocumentId(documentId: string): void {
  if (!documentId || documentId.trim() === '') {
    throw new Error('document_id is required but was not provided');
  }

  // Google Doc IDs are typically 25-60 chars, alphanumeric + - _
  const docIdPattern = /^[a-zA-Z0-9_-]{10,}$/;
  if (!docIdPattern.test(documentId.trim())) {
    throw new Error(
      `document_id "${documentId}" does not appear to be a valid Google Doc ID. ` +
        'It should be the long alphanumeric string from the document URL.'
    );
  }
}

/**
 * Builds the full URL for a Google Doc.
 */
export function buildDocumentUrl(documentId: string): string {
  return `https://docs.google.com/document/d/${documentId}/edit`;
}
