// SPDX-License-Identifier: GPL-3.0

import {
  parseMarkdown,
  extractBoldRanges,
  segmentsToBatchRequests,
  enrichWithInsights,
} from '../src/markdown';
import type { InsightsData } from '../src/types';

describe('Markdown - parseMarkdown', () => {
  it('should parse H1 heading', () => {
    const segments = parseMarkdown('# My Title');
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe('heading1');
    expect(segments[0].text).toBe('My Title');
  });

  it('should parse H2 heading', () => {
    const segments = parseMarkdown('## Sub Heading');
    expect(segments[0].type).toBe('heading2');
    expect(segments[0].text).toBe('Sub Heading');
  });

  it('should parse H3 heading', () => {
    const segments = parseMarkdown('### Deep Section');
    expect(segments[0].type).toBe('heading3');
    expect(segments[0].text).toBe('Deep Section');
  });

  it('should parse H4 heading', () => {
    const segments = parseMarkdown('#### Level 4');
    expect(segments[0].type).toBe('heading4');
    expect(segments[0].text).toBe('Level 4');
  });

  it('should parse bullet list items', () => {
    const segments = parseMarkdown('- First item\n- Second item');
    expect(segments[0].type).toBe('bullet');
    expect(segments[0].text).toBe('First item');
    expect(segments[1].type).toBe('bullet');
    expect(segments[1].text).toBe('Second item');
  });

  it('should parse numbered list items as bullets', () => {
    const segments = parseMarkdown('1. Item one\n2. Item two');
    expect(segments[0].type).toBe('bullet');
    expect(segments[0].text).toBe('Item one');
  });

  it('should parse horizontal rule (---)', () => {
    const segments = parseMarkdown('---');
    expect(segments[0].type).toBe('hr');
  });

  it('should parse blank lines', () => {
    const segments = parseMarkdown('Line one\n\nLine two');
    expect(segments[1].type).toBe('blank');
  });

  it('should parse paragraph text', () => {
    const segments = parseMarkdown('This is a normal paragraph.');
    expect(segments[0].type).toBe('paragraph');
    expect(segments[0].text).toBe('This is a normal paragraph.');
  });

  it('should parse bold text within paragraph', () => {
    const segments = parseMarkdown('Hello **world** today');
    expect(segments[0].type).toBe('paragraph');
    expect(segments[0].text).toBe('Hello world today');
    expect(segments[0].boldRanges).toEqual([{ start: 6, end: 11 }]);
  });

  it('should parse complex markdown document', () => {
    const md = `# Changelog v1.0.0\n\n## What's New\n\n- Feature A\n- **Important** fix\n\n---\n\nSome notes.`;
    const segments = parseMarkdown(md);
    const types = segments.map((s) => s.type);
    expect(types).toContain('heading1');
    expect(types).toContain('heading2');
    expect(types).toContain('bullet');
    expect(types).toContain('hr');
    expect(types).toContain('paragraph');
  });
});

describe('Markdown - extractBoldRanges', () => {
  it('should extract single bold range', () => {
    const { text, boldRanges } = extractBoldRanges('Hello **world** foo');
    expect(text).toBe('Hello world foo');
    expect(boldRanges).toEqual([{ start: 6, end: 11 }]);
  });

  it('should extract multiple bold ranges', () => {
    const { text, boldRanges } = extractBoldRanges('**A** and **B**');
    expect(text).toBe('A and B');
    expect(boldRanges).toHaveLength(2);
    expect(boldRanges[0]).toEqual({ start: 0, end: 1 });
    expect(boldRanges[1]).toEqual({ start: 6, end: 7 });
  });

  it('should handle text with no bold markers', () => {
    const { text, boldRanges } = extractBoldRanges('plain text');
    expect(text).toBe('plain text');
    expect(boldRanges).toHaveLength(0);
  });

  it('should handle __double underscore__ bold', () => {
    const { text, boldRanges } = extractBoldRanges('__bold text__');
    expect(text).toBe('bold text');
    expect(boldRanges).toEqual([{ start: 0, end: 9 }]);
  });

  it('should not treat unmatched markers as bold', () => {
    const { text, boldRanges } = extractBoldRanges('**no close');
    expect(boldRanges).toHaveLength(0);
    expect(text).toBe('**no close');
  });
});

describe('Markdown - segmentsToBatchRequests', () => {
  it('should generate insertText requests for each segment', () => {
    const segments = parseMarkdown('# Title\nSome text');
    const { requests } = segmentsToBatchRequests(segments, 1, '');
    const insertRequests = requests.filter((r) => r.insertText);
    expect(insertRequests.length).toBeGreaterThan(0);
  });

  it('should embed idempotency marker at the start', () => {
    const segments = parseMarkdown('Hello');
    const { requests } = segmentsToBatchRequests(segments, 1, 'repo:abc:def');
    const firstInsert = requests.find((r) => r.insertText);
    expect(firstInsert?.insertText?.text).toContain('[idempotency:repo:abc:def]');
  });

  it('should apply HEADING_1 named style for H1 via updateParagraphStyle', () => {
    const segments = parseMarkdown('# Big Title');
    const { requests } = segmentsToBatchRequests(segments, 1, '');
    const styleRequest = requests.find(
      (r) => r.updateParagraphStyle?.paragraphStyle?.namedStyleType === 'HEADING_1'
    );
    expect(styleRequest).toBeDefined();
    // No legacy font-size override via updateTextStyle
    const fontSizeRequest = requests.find(
      (r) => r.updateTextStyle?.textStyle?.fontSize?.magnitude === 16
    );
    expect(fontSizeRequest).toBeUndefined();
  });

  it('should apply HEADING_2 named style for H2 via updateParagraphStyle', () => {
    const segments = parseMarkdown('## Section');
    const { requests } = segmentsToBatchRequests(segments, 1, '');
    const styleRequest = requests.find(
      (r) => r.updateParagraphStyle?.paragraphStyle?.namedStyleType === 'HEADING_2'
    );
    expect(styleRequest).toBeDefined();
    // No legacy font-size override via updateTextStyle
    const fontSizeRequest = requests.find(
      (r) => r.updateTextStyle?.textStyle?.fontSize?.magnitude === 13
    );
    expect(fontSizeRequest).toBeUndefined();
  });

  it('should apply HEADING_X paragraph style for headings and NORMAL_TEXT for non-headings', () => {
    const segments = parseMarkdown('# Title\n## Sub\nParagraph');
    const { requests } = segmentsToBatchRequests(segments, 1, '');
    const h1Style = requests.find(
      (r) => r.updateParagraphStyle?.paragraphStyle?.namedStyleType === 'HEADING_1'
    );
    expect(h1Style).toBeDefined();
    const h2Style = requests.find(
      (r) => r.updateParagraphStyle?.paragraphStyle?.namedStyleType === 'HEADING_2'
    );
    expect(h2Style).toBeDefined();
    const normalStyle = requests.find(
      (r) => r.updateParagraphStyle?.paragraphStyle?.namedStyleType === 'NORMAL_TEXT'
    );
    expect(normalStyle).toBeDefined();
  });

  it('should apply compact spacing (lineSpacing 115, spaceBelow 2) to all non-blank segments', () => {
    const segments = parseMarkdown('Some paragraph text');
    const { requests } = segmentsToBatchRequests(segments, 1, '');
    const styleReq = requests.find(
      (r) => r.updateParagraphStyle?.paragraphStyle?.namedStyleType === 'NORMAL_TEXT'
    );
    expect(styleReq?.updateParagraphStyle?.paragraphStyle?.lineSpacing).toBe(115);
    expect(styleReq?.updateParagraphStyle?.paragraphStyle?.spaceBelow).toEqual({ magnitude: 2, unit: 'PT' });
    expect(styleReq?.updateParagraphStyle?.paragraphStyle?.spaceAbove).toEqual({ magnitude: 0, unit: 'PT' });
    expect(styleReq?.updateParagraphStyle?.fields).toBe('namedStyleType,spaceAbove,spaceBelow,lineSpacing');
  });

  it('should apply 8pt spaceAbove for heading segments', () => {
    const segments = parseMarkdown('## A Heading');
    const { requests } = segmentsToBatchRequests(segments, 1, '');
    const styleReq = requests.find(
      (r) => r.updateParagraphStyle?.paragraphStyle?.namedStyleType === 'HEADING_2'
    );
    expect(styleReq?.updateParagraphStyle?.paragraphStyle?.spaceAbove).toEqual({ magnitude: 8, unit: 'PT' });
  });

  it('should minimise blank line paragraph height with tight spacing', () => {
    const segments = parseMarkdown('Line one\n\nLine two');
    const { requests } = segmentsToBatchRequests(segments, 1, '');
    // The blank-line updateParagraphStyle has no namedStyleType — only spacing fields
    const blankStyle = requests.find(
      (r) =>
        r.updateParagraphStyle !== undefined &&
        r.updateParagraphStyle.paragraphStyle.namedStyleType === undefined &&
        r.updateParagraphStyle.paragraphStyle.lineSpacing === 100
    );
    expect(blankStyle).toBeDefined();
    expect(blankStyle?.updateParagraphStyle?.paragraphStyle?.spaceAbove).toEqual({ magnitude: 0, unit: 'PT' });
    expect(blankStyle?.updateParagraphStyle?.paragraphStyle?.spaceBelow).toEqual({ magnitude: 0, unit: 'PT' });
    expect(blankStyle?.updateParagraphStyle?.fields).toBe('spaceAbove,spaceBelow,lineSpacing');
  });

  it('should style idempotency marker as invisible (1pt white text)', () => {
    const segments = parseMarkdown('Hello');
    const { requests } = segmentsToBatchRequests(segments, 1, 'key');
    const markerStyle = requests.find(
      (r) => r.updateTextStyle?.textStyle?.fontSize?.magnitude === 1
    );
    expect(markerStyle).toBeDefined();
    expect(markerStyle?.updateTextStyle?.textStyle?.foregroundColor?.color?.rgbColor?.red).toBe(1);
    expect(markerStyle?.updateTextStyle?.textStyle?.foregroundColor?.color?.rgbColor?.green).toBe(1);
    expect(markerStyle?.updateTextStyle?.textStyle?.foregroundColor?.color?.rgbColor?.blue).toBe(1);
  });

  it('should create bullet formatting for list items', () => {
    const segments = parseMarkdown('- item one');
    const { requests } = segmentsToBatchRequests(segments, 1, '');
    const bulletRequest = requests.find((r) => r.createParagraphBullets);
    expect(bulletRequest).toBeDefined();
  });

  it('should apply bold text style for bold ranges', () => {
    const segments = parseMarkdown('**bold** text');
    const { requests } = segmentsToBatchRequests(segments, 1, '');
    const boldRequest = requests.find(
      (r) => r.updateTextStyle?.textStyle?.bold === true
    );
    expect(boldRequest).toBeDefined();
  });

  it('should return totalCharsInserted > 0 for non-empty content', () => {
    const segments = parseMarkdown('# Hello\nWorld');
    const { totalCharsInserted } = segmentsToBatchRequests(segments, 1, '');
    expect(totalCharsInserted).toBeGreaterThan(0);
  });

  it('should not include idempotency marker when key is empty', () => {
    const segments = parseMarkdown('Hello');
    const { requests } = segmentsToBatchRequests(segments, 1, '');
    const firstInsert = requests.find((r) => r.insertText);
    expect(firstInsert?.insertText?.text).not.toContain('[idempotency:');
  });
});

describe('Markdown - enrichWithInsights', () => {
  it('should prepend metadata block from insights', () => {
    const insights: InsightsData = {
      repository: 'org/repo',
      generated_at: '2024-01-01T00:00:00Z',
      from_sha: 'abc123',
      to_sha: 'def456',
      total_commits: 42,
      contributors: ['alice', 'bob'],
      file_changes: { added: 5, modified: 10, deleted: 2 },
    };
    const enriched = enrichWithInsights('# Original Content', insights);
    expect(enriched).toContain('## Metadata');
    expect(enriched).toContain('org/repo');
    expect(enriched).toContain('abc123');
    expect(enriched).toContain('42');
    expect(enriched).toContain('alice');
    expect(enriched).toContain('# Original Content');
  });

  it('should handle partial insights data gracefully', () => {
    const insights: InsightsData = { repository: 'my/repo' };
    const enriched = enrichWithInsights('Content', insights);
    expect(enriched).toContain('my/repo');
    expect(enriched).toContain('Content');
    expect(enriched).not.toContain('undefined');
  });
});
