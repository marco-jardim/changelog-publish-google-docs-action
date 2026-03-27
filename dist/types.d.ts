export type Mode = 'append' | 'prepend' | 'replace_section';
export type ActionTaken = 'appended' | 'prepended' | 'replaced' | 'skipped' | 'dry_run' | 'error';
export interface ActionInputs {
    reportPath: string;
    documentId: string;
    serviceAccountKey: string;
    idempotencyKey: string;
    insightsPath: string;
    mode: Mode;
    sectionHeader: string;
    dryRun: boolean;
}
export interface ActionOutputs {
    documentUrl: string;
    actionTaken: ActionTaken;
    idempotencyHit: boolean;
}
export interface ServiceAccountCredentials {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
}
export interface InsightsData {
    generated_at?: string;
    from_sha?: string;
    to_sha?: string;
    repository?: string;
    total_commits?: number;
    contributors?: string[];
    file_changes?: {
        added: number;
        modified: number;
        deleted: number;
    };
    [key: string]: unknown;
}
export interface DocsBatchUpdateRequest {
    requests: DocsRequest[];
}
export interface DocsRequest {
    insertText?: InsertTextRequest;
    updateParagraphStyle?: UpdateParagraphStyleRequest;
    updateTextStyle?: UpdateTextStyleRequest;
    insertPageBreak?: InsertPageBreakRequest;
    createParagraphBullets?: CreateParagraphBulletsRequest;
    deleteContentRange?: DeleteContentRangeRequest;
}
export interface InsertTextRequest {
    text: string;
    location: TextLocation;
}
export interface InsertPageBreakRequest {
    location: TextLocation;
}
export interface TextLocation {
    index: number;
    segmentId?: string;
}
export interface UpdateParagraphStyleRequest {
    range: TextRange;
    paragraphStyle: ParagraphStyle;
    fields: string;
}
export interface UpdateTextStyleRequest {
    range: TextRange;
    textStyle: TextStyle;
    fields: string;
}
export interface CreateParagraphBulletsRequest {
    range: TextRange;
    bulletPreset: string;
}
export interface DeleteContentRangeRequest {
    range: TextRange;
}
export interface TextRange {
    startIndex: number;
    endIndex: number;
    segmentId?: string;
}
export interface ParagraphStyle {
    namedStyleType?: string;
    spaceAbove?: {
        magnitude: number;
        unit: string;
    };
    spaceBelow?: {
        magnitude: number;
        unit: string;
    };
}
export interface TextStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
}
export interface ParsedSegment {
    text: string;
    type: 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'paragraph' | 'bullet' | 'hr' | 'blank';
    boldRanges?: Array<{
        start: number;
        end: number;
    }>;
}
export interface DocContent {
    plainText: string;
    endIndex: number;
}
