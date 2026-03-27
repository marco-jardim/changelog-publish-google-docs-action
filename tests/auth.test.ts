// SPDX-License-Identifier: GPL-3.0

import { decodeServiceAccountKey, validateDocumentId, buildDocumentUrl } from '../src/auth';

describe('Auth - decodeServiceAccountKey', () => {
  const validCredentials = {
    type: 'service_account',
    project_id: 'test-project',
    private_key_id: 'key-id-123',
    private_key: '-----BEGIN RSA PRIVATE KEY-----\nMockKey\n-----END RSA PRIVATE KEY-----',
    client_email: 'test@test-project.iam.gserviceaccount.com',
    client_id: '123456789',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/test',
  };

  function encodeKey(obj: object): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64');
  }

  it('should decode a valid base64-encoded service account key', () => {
    const encoded = encodeKey(validCredentials);
    const result = decodeServiceAccountKey(encoded);
    expect(result.client_email).toBe(validCredentials.client_email);
    expect(result.project_id).toBe(validCredentials.project_id);
    expect(result.type).toBe('service_account');
  });

  it('should throw if the key is empty string', () => {
    expect(() => decodeServiceAccountKey('')).toThrow('service_account_key is required');
  });

  it('should throw if the key is not valid base64 JSON', () => {
    const notJson = Buffer.from('this is not json').toString('base64');
    expect(() => decodeServiceAccountKey(notJson)).toThrow('not valid JSON');
  });

  it('should throw if the type is not service_account', () => {
    const wrongType = { ...validCredentials, type: 'authorized_user' };
    const encoded = encodeKey(wrongType);
    expect(() => decodeServiceAccountKey(encoded)).toThrow('service_account');
  });

  it('should throw if required fields are missing', () => {
    const missingKey = { type: 'service_account', project_id: 'x', client_email: 'x@x.com' };
    const encoded = encodeKey(missingKey);
    expect(() => decodeServiceAccountKey(encoded)).toThrow('missing required fields');
  });

  it('should handle whitespace in base64 key (trim)', () => {
    const encoded = '  ' + encodeKey(validCredentials) + '  ';
    const result = decodeServiceAccountKey(encoded);
    expect(result.type).toBe('service_account');
  });
});

describe('Auth - validateDocumentId', () => {
  it('should not throw for a valid document ID', () => {
    expect(() => validateDocumentId('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms')).not.toThrow();
  });

  it('should throw for an empty document ID', () => {
    expect(() => validateDocumentId('')).toThrow('document_id is required');
  });

  it('should throw for a document ID that is too short', () => {
    expect(() => validateDocumentId('abc')).toThrow('valid Google Doc ID');
  });

  it('should throw for a document ID with invalid characters', () => {
    expect(() => validateDocumentId('invalid doc id with spaces')).toThrow('valid Google Doc ID');
  });
});

describe('Auth - buildDocumentUrl', () => {
  it('should build correct Google Doc URL', () => {
    const url = buildDocumentUrl('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms');
    expect(url).toBe(
      'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit'
    );
  });
});
