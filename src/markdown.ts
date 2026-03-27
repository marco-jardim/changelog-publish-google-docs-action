// SPDX-License-Identifier: GPL-3.0

import type {
  ParsedSegment,
  DocsRequest,
  InsightsData,
} from './types';

/**
 * Parses a markdown string into structured segments.
 * Supports: headings H1-H4, bold (**text**), bullet lists, horizontal rules, paragraphs.
 */
export function parseMarkdown(markdown: string): ParsedSegment[] {
  const lines = markdown.split('\n');
  const segments: ParsedSegment[] = [];

  for (const rawLine of lines) {
    const line = rawLine;

    // Blank line
    if (line.trim() === '') {
      segments.push({ text: '', type: 'blank' });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      segments.push({ text: '────────────────────────────────────', type: 'hr' });
      continue;
    }

    // H1
    if (/^#\s+/.test(line)) {
      const text = line.replace(/^#\s+/, '').trim();
      segments.push({ text, type: 'heading1', boldRanges: [] });
      continue;
    }

    // H2
    if (/^##\s+/.test(line)) {
      const text = line.replace(/^##\s+/, '').trim();
      segments.push({ text, type: 'heading2', boldRanges: [] });
      continue;
    }

    // H3
    if (/^###\s+/.test(line)) {
      const text = line.replace(/^###\s+/, '').trim();
      segments.push({ text, type: 'heading3', boldRanges: [] });
      continue;
    }

    // H4
    if (/^####\s+/.test(line)) {
      const text = line.replace(/^####\s+/, '').trim();
      segments.push({ text, type: 'heading4', boldRanges: [] });
      continue;
    }

    // Bullet list item (-, *, +)
    if (/^[\-\*\+]\s+/.test(line)) {
      const rawText = line.replace(/^[\-\*\+]\s+/, '');
      const { text, boldRanges } = extractBoldRanges(rawText);
      segments.push({ text, type: 'bullet', boldRanges });
      continue;
    }

    // Numbered list item
    if (/^\d+\.\s+/.test(line)) {
      const rawText = line.replace(/^\d+\.\s+/, '');
      const { text, boldRanges } = extractBoldRanges(rawText);
      segments.push({ text, type: 'bullet', boldRanges });
      continue;
    }

    // Regular paragraph
    const { text, boldRanges } = extractBoldRanges(line);
    segments.push({ text, type: 'paragraph', boldRanges });
  }

  return segments;
}

/**
 * Extracts bold ranges from inline markdown bold syntax (**text** or __text__).
 * Returns plain text with bold character ranges.
 */
export function extractBoldRanges(
  text: string
): { text: string; boldRanges: Array<{ start: number; end: number }> } {
  const boldRanges: Array<{ start: number; end: number }> = [];
  let result = '';
  let i = 0;

  while (i < text.length) {
    // Check for **bold** or __bold__
    if (
      (text[i] === '*' && text[i + 1] === '*') ||
      (text[i] === '_' && text[i + 1] === '_')
    ) {
      const marker = text.substring(i, i + 2);
      const closeIdx = text.indexOf(marker, i + 2);
      if (closeIdx !== -1) {
        const boldText = text.substring(i + 2, closeIdx);
        const start = result.length;
        result += boldText;
        boldRanges.push({ start, end: start + boldText.length });
        i = closeIdx + 2;
        continue;
      }
    }
    result += text[i];
    i++;
  }

  return { text: result, boldRanges };
}

/**
 * Converts parsed segments into Google Docs batchUpdate requests.
 * All text is inserted at the given `insertIndex`.
 * Returns requests and the new end index after insertion.
 */
export function segmentsToBatchRequests(
  segments: ParsedSegment[],
  insertIndex: number,
  idempotencyKey: string
): { requests: DocsRequest[]; totalCharsInserted: number } {
  const requests: DocsRequest[] = [];
  let currentIndex = insertIndex;
  let totalCharsInserted = 0;

  // Insert idempotency key as the very first line (invisible marker style)
  if (idempotencyKey) {
    const marker = `[idempotency:${idempotencyKey}]\n`;
    requests.push({
      insertText: {
        text: marker,
        location: { index: currentIndex },
      },
    });
    // Style as very small / hidden-ish text (paragraph style NORMAL_TEXT but we make it tiny)
    requests.push({
      updateTextStyle: {
        range: { startIndex: currentIndex, endIndex: currentIndex + marker.length - 1 },
        textStyle: {},
        fields: 'fontSize',
      },
    });
    currentIndex += marker.length;
    totalCharsInserted += marker.length;
  }

  for (const segment of segments) {
    if (segment.type === 'blank') {
      // Insert a newline for spacing
      const text = '\n';
      requests.push({
        insertText: {
          text,
          location: { index: currentIndex },
        },
      });
      currentIndex += text.length;
      totalCharsInserted += text.length;
      continue;
    }

    if (segment.type === 'hr') {
      const text = `${segment.text}\n`;
      requests.push({
        insertText: {
          text,
          location: { index: currentIndex },
        },
      });
      currentIndex += text.length;
      totalCharsInserted += text.length;
      continue;
    }

    const text = `${segment.text}\n`;
    const segStartIndex = currentIndex;

    requests.push({
      insertText: {
        text,
        location: { index: currentIndex },
      },
    });

    // Apply paragraph style
    const namedStyle = getNamedStyleType(segment.type);
    if (namedStyle !== 'NORMAL_TEXT') {
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex: segStartIndex,
            endIndex: segStartIndex + text.length,
          },
          paragraphStyle: {
            namedStyleType: namedStyle,
          },
          fields: 'namedStyleType',
        },
      });
    }

    // Apply bold ranges
    if (segment.boldRanges && segment.boldRanges.length > 0) {
      for (const boldRange of segment.boldRanges) {
        requests.push({
          updateTextStyle: {
            range: {
              startIndex: segStartIndex + boldRange.start,
              endIndex: segStartIndex + boldRange.end,
            },
            textStyle: { bold: true },
            fields: 'bold',
          },
        });
      }
    }

    // Apply bullet style
    if (segment.type === 'bullet') {
      requests.push({
        createParagraphBullets: {
          range: {
            startIndex: segStartIndex,
            endIndex: segStartIndex + text.length,
          },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      });
    }

    currentIndex += text.length;
    totalCharsInserted += text.length;
  }

  return { requests, totalCharsInserted };
}

/**
 * Maps segment type to Google Docs named style.
 */
function getNamedStyleType(
  type: ParsedSegment['type']
): string {
  switch (type) {
    case 'heading1':
      return 'HEADING_1';
    case 'heading2':
      return 'HEADING_2';
    case 'heading3':
      return 'HEADING_3';
    case 'heading4':
      return 'HEADING_4';
    case 'bullet':
    case 'paragraph':
    case 'hr':
    case 'blank':
    default:
      return 'NORMAL_TEXT';
  }
}

/**
 * Enriches the markdown content with metadata from insights.v1.json.
 * Prepends a metadata block before the main content.
 */
export function enrichWithInsights(
  markdown: string,
  insights: InsightsData
): string {
  const lines: string[] = [];

  lines.push('## Metadata');
  lines.push('');

  if (insights.repository) {
    lines.push(`**Repository:** ${insights.repository}`);
  }
  if (insights.generated_at) {
    lines.push(`**Generated At:** ${insights.generated_at}`);
  }
  if (insights.from_sha && insights.to_sha) {
    lines.push(`**Commit Range:** \`${insights.from_sha}\` → \`${insights.to_sha}\``);
  }
  if (typeof insights.total_commits === 'number') {
    lines.push(`**Total Commits:** ${insights.total_commits}`);
  }
  if (insights.contributors && insights.contributors.length > 0) {
    lines.push(`**Contributors:** ${insights.contributors.join(', ')}`);
  }
  if (insights.file_changes) {
    const { added, modified, deleted } = insights.file_changes;
    lines.push(`**File Changes:** +${added} added, ~${modified} modified, -${deleted} deleted`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n') + markdown;
}
