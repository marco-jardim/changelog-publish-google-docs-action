import type { ParsedSegment, DocsRequest, InsightsData } from './types';
/**
 * Parses a markdown string into structured segments.
 * Supports: headings H1-H4, bold (**text**), bullet lists, horizontal rules, paragraphs.
 */
export declare function parseMarkdown(markdown: string): ParsedSegment[];
/**
 * Extracts bold ranges from inline markdown bold syntax (**text** or __text__).
 * Returns plain text with bold character ranges.
 */
export declare function extractBoldRanges(text: string): {
    text: string;
    boldRanges: Array<{
        start: number;
        end: number;
    }>;
};
/**
 * Converts parsed segments into Google Docs batchUpdate requests.
 * All text is inserted at the given `insertIndex`.
 * Returns requests and the new end index after insertion.
 */
export declare function segmentsToBatchRequests(segments: ParsedSegment[], insertIndex: number, idempotencyKey: string): {
    requests: DocsRequest[];
    totalCharsInserted: number;
};
/**
 * Enriches the markdown content with metadata from insights.v1.json.
 * Prepends a metadata block before the main content.
 */
export declare function enrichWithInsights(markdown: string, insights: InsightsData): string;
