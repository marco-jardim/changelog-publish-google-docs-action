// SPDX-License-Identifier: GPL-3.0

import { checkIdempotency, findSectionIndex, findSectionEndIndex } from '../src/idempotency';
import type { docs_v1 } from 'googleapis';

// We mock getDocumentContent since it requires a live API client
// The actual function is tested via integration-style mocks in docs.test.ts

describe('Idempotency - checkIdempotency', () => {
  it('should return false when idempotency_key is not in the document', () => {
    const plainText = 'This is some document content without any markers.';
    const result = checkIdempotency(plainText, 'repo:abc123:def456');
    expect(result).toBe(false);
  });

  it('should return true when idempotency_key is present in the document', () => {
    const key = 'repo:abc123:def456';
    const plainText = `Some text\n[idempotency:${key}]\nMore text`;
    const result = checkIdempotency(plainText, key);
    expect(result).toBe(true);
  });

  it('should return false when idempotency_key is empty string', () => {
    const plainText = 'Some document content';
    const result = checkIdempotency(plainText, '');
    expect(result).toBe(false);
  });

  it('should return false when idempotency_key has whitespace only', () => {
    const plainText = 'Some document content';
    const result = checkIdempotency(plainText, '   ');
    expect(result).toBe(false);
  });

  it('should be case-sensitive in key matching', () => {
    const key = 'Repo:ABC:DEF';
    const plainText = `[idempotency:repo:abc:def]`;
    const result = checkIdempotency(plainText, key);
    expect(result).toBe(false);
  });

  it('should not match partial key substrings', () => {
    const plainText = '[idempotency:repo:abc]';
    const result = checkIdempotency(plainText, 'repo:abc:def');
    expect(result).toBe(false);
  });

  it('should match when key appears anywhere in the document', () => {
    const key = 'my-project:v1:v2';
    const plainText = `\n\nParagraph one.\n\n[idempotency:${key}]\n\nParagraph two.`;
    const result = checkIdempotency(plainText, key);
    expect(result).toBe(true);
  });
});

describe('Idempotency - findSectionIndex', () => {
  function buildMockDoc(elements: docs_v1.Schema$StructuralElement[]): docs_v1.Schema$Document {
    return { body: { content: elements } };
  }

  function buildParagraph(
    text: string,
    startIndex: number,
    endIndex: number,
    namedStyleType?: string
  ): docs_v1.Schema$StructuralElement {
    return {
      startIndex,
      endIndex,
      paragraph: {
        elements: [{ textRun: { content: text } }],
        paragraphStyle: namedStyleType ? { namedStyleType } : undefined,
      },
    };
  }

  it('should find a section by exact header text', () => {
    const doc = buildMockDoc([
      buildParagraph('Introduction\n', 0, 14, 'HEADING_2'),
      buildParagraph('Some Content\n', 14, 27),
      buildParagraph('Changelog\n', 27, 38, 'HEADING_2'),
    ]);
    const idx = findSectionIndex(doc, 'Changelog');
    expect(idx).toBe(27);
  });

  it('should return -1 when section header is not found', () => {
    const doc = buildMockDoc([buildParagraph('Other content\n', 0, 15)]);
    const idx = findSectionIndex(doc, 'Nonexistent');
    expect(idx).toBe(-1);
  });

  it('should be case-insensitive in header matching', () => {
    const doc = buildMockDoc([buildParagraph('My Section\n', 0, 12, 'HEADING_1')]);
    const idx = findSectionIndex(doc, 'my section');
    expect(idx).toBe(0);
  });

  it('should return -1 for empty document', () => {
    const doc: docs_v1.Schema$Document = { body: { content: [] } };
    const idx = findSectionIndex(doc, 'anything');
    expect(idx).toBe(-1);
  });
});

describe('Idempotency - findSectionEndIndex', () => {
  function buildMockDoc(elements: docs_v1.Schema$StructuralElement[]): docs_v1.Schema$Document {
    return { body: { content: elements } };
  }

  it('should find end index at the next heading', () => {
    const doc = buildMockDoc([
      {
        startIndex: 0,
        endIndex: 10,
        paragraph: {
          elements: [{ textRun: { content: 'Section 1\n' } }],
          paragraphStyle: { namedStyleType: 'HEADING_2' },
        },
      },
      {
        startIndex: 10,
        endIndex: 25,
        paragraph: { elements: [{ textRun: { content: 'Body text here\n' } }] },
      },
      {
        startIndex: 25,
        endIndex: 35,
        paragraph: {
          elements: [{ textRun: { content: 'Section 2\n' } }],
          paragraphStyle: { namedStyleType: 'HEADING_2' },
        },
      },
    ]);

    const endIdx = findSectionEndIndex(doc, 0);
    expect(endIdx).toBe(25);
  });
});
