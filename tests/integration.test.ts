// SPDX-License-Identifier: GPL-3.0
// Integration tests for the main action flow (with mocked APIs)

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// We'll test the run() function with all external calls mocked

// Mock @actions/core
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
}));

// Mock googleapis
jest.mock('googleapis', () => {
  const mockBatchUpdate = jest.fn().mockResolvedValue({});
  const mockGet = jest.fn().mockResolvedValue({
    data: {
      body: {
        content: [
          {
            startIndex: 0,
            endIndex: 25,
            paragraph: {
              elements: [{ textRun: { content: 'Existing document content\n' } }],
            },
          },
        ],
      },
    },
  });

  return {
    google: {
      auth: {
        GoogleAuth: jest.fn().mockImplementation(() => ({
          getClient: jest.fn().mockResolvedValue({}),
        })),
      },
      docs: jest.fn().mockReturnValue({
        documents: {
          get: mockGet,
          batchUpdate: mockBatchUpdate,
        },
      }),
    },
  };
});

import * as core from '@actions/core';
import { run } from '../src/index';

const mockCore = core as jest.Mocked<typeof core>;

function makeValidServiceAccountKey(): string {
  const creds = {
    type: 'service_account',
    project_id: 'test-proj',
    private_key_id: 'key-id',
    private_key: '-----BEGIN RSA PRIVATE KEY-----\nfakekey\n-----END RSA PRIVATE KEY-----',
    client_email: 'test@test-proj.iam.gserviceaccount.com',
    client_id: '123',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1',
  };
  return Buffer.from(JSON.stringify(creds)).toString('base64');
}

function createTempMarkdownFile(content: string): string {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `test-changelog-${Date.now()}.md`);
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe('Integration - Action run()', () => {
  let tempMdPath: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tempMdPath = createTempMarkdownFile('# Test Changelog\n\n- Feature A\n- Bug fix B\n');

    // Default inputs
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        report_path: tempMdPath,
        document_id: 'validDocumentId1234567890',
        service_account_key: makeValidServiceAccountKey(),
        idempotency_key: '',
        insights_path: '',
        mode: 'append',
        section_header: '',
        dry_run: 'false',
      };
      return inputs[name] ?? '';
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempMdPath)) {
      fs.unlinkSync(tempMdPath);
    }
  });

  it('should return appended action_taken for normal append mode', async () => {
    const result = await run();
    expect(result.actionTaken).toBe('appended');
    expect(result.idempotencyHit).toBe(false);
    expect(result.documentUrl).toContain('docs.google.com');
  });

  it('should return dry_run action_taken when dry_run is true', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        report_path: tempMdPath,
        document_id: 'validDocumentId1234567890',
        service_account_key: makeValidServiceAccountKey(),
        idempotency_key: 'repo:abc:def',
        insights_path: '',
        mode: 'append',
        section_header: '',
        dry_run: 'true',
      };
      return inputs[name] ?? '';
    });

    const result = await run();
    expect(result.actionTaken).toBe('dry_run');
  });

  it('should return skipped when idempotency key is already in document', async () => {
    const key = 'repo:already-present:abc123';

    // Mock document with the idempotency key already present
    const { google } = await import('googleapis');
    (google.docs as jest.Mock).mockReturnValue({
      documents: {
        get: jest.fn().mockResolvedValue({
          data: {
            body: {
              content: [
                {
                  startIndex: 0,
                  endIndex: 50,
                  paragraph: {
                    elements: [
                      { textRun: { content: `[idempotency:${key}]\nExisting content\n` } },
                    ],
                  },
                },
              ],
            },
          },
        }),
        batchUpdate: jest.fn().mockResolvedValue({}),
      },
    });

    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        report_path: tempMdPath,
        document_id: 'validDocumentId1234567890',
        service_account_key: makeValidServiceAccountKey(),
        idempotency_key: key,
        insights_path: '',
        mode: 'append',
        section_header: '',
        dry_run: 'false',
      };
      return inputs[name] ?? '';
    });

    const result = await run();
    expect(result.actionTaken).toBe('skipped');
    expect(result.idempotencyHit).toBe(true);
  });

  it('should return error when report_path does not exist', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        report_path: '/nonexistent/path/to/file.md',
        document_id: 'validDocumentId1234567890',
        service_account_key: makeValidServiceAccountKey(),
        idempotency_key: '',
        insights_path: '',
        mode: 'append',
        section_header: '',
        dry_run: 'false',
      };
      return inputs[name] ?? '';
    });

    const result = await run();
    expect(result.actionTaken).toBe('error');
    expect(mockCore.setFailed).toHaveBeenCalled();
  });

  it('should return error when service_account_key is missing', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        report_path: tempMdPath,
        document_id: 'validDocumentId1234567890',
        service_account_key: '',
        idempotency_key: '',
        insights_path: '',
        mode: 'append',
        section_header: '',
        dry_run: 'false',
      };
      return inputs[name] ?? '';
    });

    const result = await run();
    expect(result.actionTaken).toBe('error');
    expect(mockCore.setFailed).toHaveBeenCalled();
  });

  it('should call setOutput with document_url', async () => {
    await run();
    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'document_url',
      expect.stringContaining('docs.google.com')
    );
  });

  it('should call setOutput with action_taken', async () => {
    await run();
    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'action_taken',
      expect.any(String)
    );
  });

  it('should enrich content with insights when insights_path is provided', async () => {
    const tmpDir = os.tmpdir();
    const insightsPath = path.join(tmpDir, `insights-${Date.now()}.json`);
    const insights = {
      repository: 'test/repo',
      generated_at: '2024-01-01T00:00:00Z',
      from_sha: 'aaa111',
      to_sha: 'bbb222',
      total_commits: 5,
    };
    fs.writeFileSync(insightsPath, JSON.stringify(insights));

    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        report_path: tempMdPath,
        document_id: 'validDocumentId1234567890',
        service_account_key: makeValidServiceAccountKey(),
        idempotency_key: '',
        insights_path: insightsPath,
        mode: 'append',
        section_header: '',
        dry_run: 'true', // use dry_run to avoid actual API call
      };
      return inputs[name] ?? '';
    });

    const result = await run();
    // Should succeed (dry run with insights)
    expect(result.actionTaken).toBe('dry_run');

    fs.unlinkSync(insightsPath);
  });

  it('should return error for invalid mode', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        report_path: tempMdPath,
        document_id: 'validDocumentId1234567890',
        service_account_key: makeValidServiceAccountKey(),
        idempotency_key: '',
        insights_path: '',
        mode: 'invalid_mode',
        section_header: '',
        dry_run: 'false',
      };
      return inputs[name] ?? '';
    });

    const result = await run();
    expect(result.actionTaken).toBe('error');
  });
});
