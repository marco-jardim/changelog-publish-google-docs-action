// SPDX-License-Identifier: GPL-3.0

import * as core from '@actions/core';
import type { docs_v1 } from 'googleapis';
import type { DocContent } from './types';

/**
 * Reads the current document content and returns the plain text and end index.
 */
export async function getDocumentContent(
  docsClient: docs_v1.Docs,
  documentId: string
): Promise<DocContent> {
  const response = await docsClient.documents.get({
    documentId,
    fields: 'body,title',
  });

  const doc = response.data;
  if (!doc.body?.content) {
    return { plainText: '', endIndex: 1 };
  }

  let plainText = '';
  let endIndex = 1;

  for (const element of doc.body.content) {
    if (element.endIndex) {
      endIndex = Math.max(endIndex, element.endIndex);
    }

    if (element.paragraph?.elements) {
      for (const elem of element.paragraph.elements) {
        if (elem.textRun?.content) {
          plainText += elem.textRun.content;
        }
      }
    }

    if (element.table?.tableRows) {
      for (const row of element.table.tableRows) {
        if (row.tableCells) {
          for (const cell of row.tableCells) {
            if (cell.content) {
              for (const cellElem of cell.content) {
                if (cellElem.paragraph?.elements) {
                  for (const pe of cellElem.paragraph.elements) {
                    if (pe.textRun?.content) {
                      plainText += pe.textRun.content;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // endIndex points to the end of the last element, subtract 1 for valid insert position
  // Google Docs body ends with a special segment end character
  const safeEndIndex = Math.max(1, endIndex - 1);

  core.debug(`Document has ${plainText.length} characters, endIndex=${safeEndIndex}`);

  return { plainText, endIndex: safeEndIndex };
}

/**
 * Checks if the idempotency key is already present in the document text.
 * Returns true if the key was found (action should be skipped).
 */
export function checkIdempotency(
  plainText: string,
  idempotencyKey: string
): boolean {
  if (!idempotencyKey || idempotencyKey.trim() === '') {
    core.debug('No idempotency_key provided, skipping idempotency check');
    return false;
  }

  const markerPattern = `[idempotency:${idempotencyKey}]`;
  const found = plainText.includes(markerPattern);

  if (found) {
    core.info(`Idempotency key "${idempotencyKey}" already found in document. Skipping write.`);
  } else {
    core.debug(`Idempotency key "${idempotencyKey}" not found in document. Proceeding with write.`);
  }

  return found;
}

/**
 * Finds the index in the document where a section starts (by header text).
 * Returns -1 if the section header is not found.
 */
export function findSectionIndex(
  doc: docs_v1.Schema$Document,
  sectionHeader: string
): number {
  if (!doc.body?.content) {
    return -1;
  }

  const normalizedTarget = sectionHeader.trim().toLowerCase();

  for (const element of doc.body.content) {
    if (element.paragraph?.elements) {
      let elemText = '';
      for (const elem of element.paragraph.elements) {
        if (elem.textRun?.content) {
          elemText += elem.textRun.content;
        }
      }

      if (
        elemText.trim().toLowerCase() === normalizedTarget &&
        element.startIndex !== undefined &&
        element.startIndex !== null
      ) {
        return element.startIndex;
      }
    }
  }

  return -1;
}

/**
 * Finds the end index of a section (from its start until the next heading at same or higher level).
 * Used for replace_section mode.
 */
export function findSectionEndIndex(
  doc: docs_v1.Schema$Document,
  sectionStartIndex: number
): number {
  if (!doc.body?.content) {
    return sectionStartIndex;
  }

  let inSection = false;
  let sectionStartFound = false;

  for (const element of doc.body.content) {
    if (element.startIndex === sectionStartIndex) {
      sectionStartFound = true;
      inSection = true;
      continue;
    }

    if (!sectionStartFound) continue;

    if (inSection && element.paragraph) {
      const style = element.paragraph.paragraphStyle?.namedStyleType;
      if (
        style === 'HEADING_1' ||
        style === 'HEADING_2' ||
        style === 'HEADING_3' ||
        style === 'HEADING_4'
      ) {
        return element.startIndex ?? sectionStartIndex;
      }
    }
  }

  // Return end of document if no next heading found
  if (doc.body.content.length > 0) {
    const lastElem = doc.body.content[doc.body.content.length - 1];
    return (lastElem?.endIndex ?? sectionStartIndex + 1) - 1;
  }

  return sectionStartIndex;
}
