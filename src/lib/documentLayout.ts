import rules from "../data/documentImportRules.json";
import type { SourceBoundingBox, SourceTextSpan } from "./analysisContext";

export interface DocumentFragment {
  text: string; x: number; y: number; width: number; height: number; confidence: number; box: SourceBoundingBox;
}

type Row = DocumentFragment[];
const wordCount = (row: Row) => row.reduce((sum, fragment) => sum + fragment.text.trim().split(/\s+/).length, 0);

// Keep table cells together, but read sustained prose columns down before moving right.
function orderRows(rows: Row[], width: number): Row[] {
  const gutters = rows.flatMap((row) => row.slice(1).flatMap((fragment, index) => {
    const left = row[index].x + row[index].width;
    return fragment.x - left >= width * rules.layout.columnGapFraction ? [(left + fragment.x) / 2] : [];
  }));
  let split: number | undefined;
  let best = 0;
  for (const gutter of gutters) {
    const prose = rows.filter((row) => {
      if (row.some((fragment) => fragment.x < gutter && fragment.x + fragment.width > gutter)) return false;
      return wordCount(row.filter((fragment) => fragment.x + fragment.width <= gutter)) >= rules.layout.minimumProseWords
        && wordCount(row.filter((fragment) => fragment.x >= gutter)) >= rules.layout.minimumProseWords;
    }).length;
    if (prose >= rules.layout.minimumColumnRows && prose > best) { split = gutter; best = prose; }
  }
  if (split === undefined) return rows;
  const result: Row[] = [];
  let left: Row[] = [];
  let right: Row[] = [];
  const flush = () => { result.push(...left, ...right); left = []; right = []; };
  for (const row of rows) {
    if (row.some((fragment) => fragment.x < split && fragment.x + fragment.width > split)) {
      flush(); result.push(row); continue;
    }
    const leftRow = row.filter((fragment) => fragment.x < split);
    const rightRow = row.filter((fragment) => fragment.x >= split);
    if (leftRow.length) left.push(leftRow);
    if (rightRow.length) right.push(rightRow);
  }
  flush();
  return result;
}

export function joinDocumentFragments(fragments: DocumentFragment[], page: number, offset: number, width: number) {
  const rows: Row[] = [];
  for (const fragment of [...fragments].sort((a, b) => a.y - b.y || a.x - b.x)) {
    let row = rows.find((candidate) => {
      const anchor = candidate[0];
      const tolerance = Math.max(rules.layout.minimumRowTolerance, Math.min(anchor.height, fragment.height) * rules.layout.rowTolerance);
      const baselineTolerance = Math.max(rules.layout.minimumRowTolerance, Math.max(anchor.height, fragment.height) * rules.layout.rowTolerance);
      // Punctuation/dot leaders have short boxes near the baseline, not the top of the row.
      return Math.abs(anchor.y - fragment.y) <= tolerance
        || Math.abs(anchor.y + anchor.height - fragment.y - fragment.height) <= baselineTolerance;
    });
    if (!row) { row = []; rows.push(row); }
    row.push(fragment);
  }
  rows.sort((a, b) => a[0].y - b[0].y);
  rows.forEach((row) => row.sort((a, b) => a.x - b.x));
  let text = "";
  const spans: SourceTextSpan[] = [];
  for (const row of orderRows(rows, width)) {
    let previous: DocumentFragment | null = null;
    for (const fragment of row) {
      const gap = previous ? fragment.x - (previous.x + previous.width) : 0;
      if (previous) text += gap > width * rules.layout.wordGapFraction ? "\t" : " ";
      const start = offset + text.length;
      text += fragment.text;
      spans.push({ start, end: offset + text.length, page, box: fragment.box });
      previous = fragment;
    }
    text += "\n";
  }
  return { text: text.trimEnd(), spans };
}

// Both native text and OCR use viewport coordinates (including page rotation/crop).
export function normalizedBox(points: Array<[number, number]>, width: number, height: number): SourceBoundingBox {
  const left = Math.max(0, Math.min(width, ...points.map(([x]) => x)));
  const top = Math.max(0, Math.min(height, ...points.map(([, y]) => y)));
  const right = Math.max(left, Math.min(width, Math.max(...points.map(([x]) => x))));
  const bottom = Math.max(top, Math.min(height, Math.max(...points.map(([, y]) => y))));
  return { x: left / width, y: top / height, width: (right - left) / width, height: (bottom - top) / height };
}
