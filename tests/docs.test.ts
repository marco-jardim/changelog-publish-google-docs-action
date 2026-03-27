// SPDX-License-Identifier: GPL-3.0

import { vi } from 'vitest';
import {
  getAppendIndex,
  getPrependIndex,
  buildReplaceSectionRequests,
  logDryRunRequests,
} from '../src/docs';
import type { DocContent, DocsRequest } from '../src/types';

describe('Docs - getAppendIndex', () => {
  it('should return the endIndex from DocContent', () => {
    const docContent: DocContent = { plainText: 'some text', endIndex: 42 };
    expect(getAppendIndex(docContent)).toBe(42);
  });

  it('should return 1 for empty document', () => {
    const docContent: DocContent = { plainText: '', endIndex: 1 };
    expect(getAppendIndex(docContent)).toBe(1);
  });
});

describe('Docs - getPrependIndex', () => {
  it('should always return 1 (start of body)', () => {
    expect(getPrependIndex()).toBe(1);
  });
});

describe('Docs - buildReplaceSectionRequests', () => {
  it('should produce delete request followed by insert requests', () => {
    const insertRequests: DocsRequest[] = [
      { insertText: { text: 'New content\n', location: { index: 10 } } },
    ];
    const result = buildReplaceSectionRequests(
      { startIndex: 10, endIndex: 50 },
      insertRequests
    );
    expect(result).toHaveLength(2);
    expect(result[0].deleteContentRange).toBeDefined();
    expect(result[0].deleteContentRange?.range.startIndex).toBe(10);
    expect(result[0].deleteContentRange?.range.endIndex).toBe(50);
    expect(result[1].insertText).toBeDefined();
  });

  it('should handle empty insert requests', () => {
    const result = buildReplaceSectionRequests({ startIndex: 5, endIndex: 20 }, []);
    expect(result).toHaveLength(1);
    expect(result[0].deleteContentRange).toBeDefined();
  });
});

describe('Docs - logDryRunRequests', () => {
  it('should not throw when called with empty requests', () => {
    expect(() => logDryRunRequests([], 1)).not.toThrow();
  });

  it('should not throw when called with various request types', () => {
    const requests: DocsRequest[] = [
      { insertText: { text: 'Hello\n', location: { index: 1 } } },
      {
        updateParagraphStyle: {
          range: { startIndex: 1, endIndex: 7 },
          paragraphStyle: { namedStyleType: 'HEADING_1' },
          fields: 'namedStyleType',
        },
      },
      {
        updateTextStyle: {
          range: { startIndex: 1, endIndex: 5 },
          textStyle: { bold: true },
          fields: 'bold',
        },
      },
      {
        createParagraphBullets: {
          range: { startIndex: 1, endIndex: 7 },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      },
    ];
    expect(() => logDryRunRequests(requests, 1)).not.toThrow();
  });

  it('should not throw for deleteContentRange request', () => {
    const requests: DocsRequest[] = [
      {
        deleteContentRange: {
          range: { startIndex: 10, endIndex: 50 },
        },
      },
    ];
    expect(() => logDryRunRequests(requests, 10)).not.toThrow();
  });
});

describe('Docs - executeBatchUpdate (mocked)', () => {
  it('should handle 403 permission error', async () => {
    const mockError = { code: 403, message: 'Permission denied' };

    // Mock the docsClient
    const mockDocsClient = {
      documents: {
        batchUpdate: vi.fn().mockRejectedValue(mockError),
      },
    };

    const { executeBatchUpdate } = await import('../src/docs');

    await expect(
      executeBatchUpdate(
        mockDocsClient as unknown as Parameters<typeof executeBatchUpdate>[0],
        'doc-id',
        [{ insertText: { text: 'test', location: { index: 1 } } }]
      )
    ).rejects.toThrow('Permission denied (403)');
  });

  it('should handle 404 not found error', async () => {
    const mockError = { code: 404, message: 'Not found' };

    const mockDocsClient = {
      documents: {
        batchUpdate: vi.fn().mockRejectedValue(mockError),
      },
    };

    const { executeBatchUpdate } = await import('../src/docs');

    await expect(
      executeBatchUpdate(
        mockDocsClient as unknown as Parameters<typeof executeBatchUpdate>[0],
        'invalid-doc-id-here',
        [{ insertText: { text: 'test', location: { index: 1 } } }]
      )
    ).rejects.toThrow('not found (404)');
  });

  it('should not call API when requests array is empty', async () => {
    const mockDocsClient = {
      documents: {
        batchUpdate: vi.fn(),
      },
    };

    const { executeBatchUpdate } = await import('../src/docs');

    await executeBatchUpdate(
      mockDocsClient as unknown as Parameters<typeof executeBatchUpdate>[0],
      'doc-id',
      []
    );

    expect(mockDocsClient.documents.batchUpdate).not.toHaveBeenCalled();
  });
});
