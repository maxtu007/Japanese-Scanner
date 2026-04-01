/**
 * layoutReconstructor.js — Stage 2: Layout Reconstruction
 *
 * Takes raw Google Vision blocks (with bounding boxes) and produces an ordered
 * list of LayoutRegion objects in manga reading order (right-to-left columns,
 * top-to-bottom within each column), with spatially adjacent blocks merged into
 * single regions so one speech bubble stays as one rendering unit.
 *
 * Entirely deterministic — no AI calls.
 *
 * Pipeline position:
 *   OCR extraction → [THIS MODULE] → per-region cleanup → tokenization → render
 */

import { hasJapanese } from './japanese.js';

// ─── Bounding-box helpers ─────────────────────────────────────────────────────

/**
 * Expand a Google Vision BoundingBox (vertices array) into a normalised rect.
 * Returns null if the box is missing or malformed.
 */
function normalizeBbox(boundingBox) {
  const verts = boundingBox?.vertices ?? [];
  if (verts.length < 2) return null;

  const xs = verts.map((v) => v.x ?? 0);
  const ys = verts.map((v) => v.y ?? 0);
  const x1 = Math.min(...xs);
  const x2 = Math.max(...xs);
  const y1 = Math.min(...ys);
  const y2 = Math.max(...ys);

  return {
    x1, y1, x2, y2,
    cx: (x1 + x2) / 2,
    cy: (y1 + y2) / 2,
    w: x2 - x1,
    h: y2 - y1,
  };
}

/** Union of two normalized bboxes. */
function unionBbox(a, b) {
  if (!a) return b;
  if (!b) return a;
  const x1 = Math.min(a.x1, b.x1);
  const y1 = Math.min(a.y1, b.y1);
  const x2 = Math.max(a.x2, b.x2);
  const y2 = Math.max(a.y2, b.y2);
  return { x1, y1, x2, y2, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, w: x2 - x1, h: y2 - y1 };
}

// ─── Block merging (union-find) ───────────────────────────────────────────────

/**
 * Decide whether two Vision blocks should be merged into a single region.
 *
 * Merge when:
 *   · Their Y ranges overlap by at least 30 % of the smaller block's height, AND
 *   · Their horizontal gap is less than 8 % of page width.
 *
 * This handles the common case where Vision splits a single speech bubble's
 * text into two or three separate blocks (one per Vision paragraph).
 */
function isMergeable(a, b, pageWidth) {
  const threshold = pageWidth * 0.08;

  const yOverlap = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const smallerH = Math.min(a.h, b.h);
  if (smallerH <= 0) return false;
  const yOverlapRatio = yOverlap / smallerH;

  const xGap = Math.max(0, Math.max(a.x1, b.x1) - Math.min(a.x2, b.x2));

  return yOverlapRatio > 0.30 && xGap < threshold;
}

/** Standard union-find with path compression. */
function makeUF(n) {
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(x, y) { parent[find(x)] = find(y); }
  return { find, union };
}

/**
 * Cluster blocks into merge groups using single-linkage on the isMergeable
 * predicate.  Returns an array of groups; each group is an array of block
 * indices that should be combined into one LayoutRegion.
 */
function clusterBlocks(nodes, pageWidth) {
  const n = nodes.length;
  const uf = makeUF(n);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (isMergeable(nodes[i].bbox, nodes[j].bbox, pageWidth)) {
        uf.union(i, j);
      }
    }
  }

  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }

  return [...groups.values()];
}

// ─── Column detection ─────────────────────────────────────────────────────────

/**
 * Assign column indices to regions using X-center gap clustering.
 *
 * Regions are sorted right-to-left; a new column is created whenever the gap
 * between consecutive X-centers exceeds 15 % of page width.  Column 0 is the
 * rightmost (first in manga reading order).
 *
 * Mutates each region object by adding a `.column` property.
 */
function assignColumns(regions, pageWidth) {
  const gapThreshold = pageWidth * 0.15;

  // Sort descending by X-center (rightmost first)
  const sorted = [...regions].sort((a, b) => b.bbox.cx - a.bbox.cx);

  let col = 0;
  sorted[0].column = col;

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i - 1].bbox.cx - sorted[i].bbox.cx;
    if (gap > gapThreshold) col++;
    sorted[i].column = col;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Reconstruct manga reading order from raw Google Vision blocks.
 *
 * @param {object[]} blocks     - OcrBlock[] from googleVision.js
 * @param {number|null} pageWidth   - page pixel width from Vision response
 * @param {number|null} pageHeight  - page pixel height (reserved, unused)
 * @returns {LayoutRegion[]}    - ordered list of text regions, ready for cleanup
 *
 * LayoutRegion shape:
 *   { text, bbox, column, order, blocks }
 */
export function reconstructLayout(blocks, pageWidth, pageHeight) {
  void pageHeight; // reserved for future use

  // ── 1. Filter: drop blocks with no Japanese content ──────────────────────
  const valid = blocks.filter((b) => b.text && hasJapanese(b.text));
  if (valid.length === 0) return [];

  // ── 2. Compute geometry ─────────────────────────────────────────────────
  const nodes = valid.map((b) => ({
    block: b,
    bbox: normalizeBbox(b.boundingBox) ?? { x1: 0, y1: 0, x2: 0, y2: 0, cx: 0, cy: 0, w: 0, h: 0 },
  }));

  // ── 3. Determine effective page width ───────────────────────────────────
  // Fall back to the rightmost block edge if Vision didn't report page width.
  const effectivePageWidth =
    pageWidth ??
    Math.max(...nodes.map((n) => n.bbox.x2), 1);

  // ── 4. Merge adjacent blocks (same speech bubble) ───────────────────────
  const groups = clusterBlocks(nodes, effectivePageWidth);

  const regions = groups.map((indices) => {
    // Sort blocks within a group top-to-bottom before joining text
    const sorted = indices
      .map((i) => nodes[i])
      .sort((a, b) => a.bbox.cy - b.bbox.cy);

    const mergedBbox = sorted.reduce((acc, n) => unionBbox(acc, n.bbox), null);
    const text = sorted.map((n) => n.block.text).join('\n');

    return {
      text,
      bbox: mergedBbox,
      blocks: sorted.map((n) => n.block),
      column: 0, // will be filled by assignColumns
      order: 0,  // will be filled after sort
    };
  });

  // ── 5. Assign columns (right-to-left, manga order) ──────────────────────
  assignColumns(regions, effectivePageWidth);

  // ── 6. Sort: column asc (0 = rightmost first), then Y asc ───────────────
  regions.sort((a, b) =>
    a.column !== b.column ? a.column - b.column : a.bbox.cy - b.bbox.cy
  );

  // ── 7. Stamp global reading order ───────────────────────────────────────
  regions.forEach((r, i) => { r.order = i; });

  return regions;
}
