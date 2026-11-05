#!/usr/bin/env bun
/**
 * 容差 greedy cut set（k=3）：用實錨＋表號＋塌縮權重，選出覆蓋節點起點的粗層 cut。
 * 這是 heuristic，不是證明的最小；輸出 cuts-coarse.tsv 供 hierarchy 用。
 *
 *   bun run scripts/build-greedy-cuts.ts [k]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const K = +(process.argv[2] || 3);

const raw = readFileSync(join(ROOT, 'site', 'reader', 'kepan', 'kepan-data.js'), 'utf8');
const kepan = JSON.parse(raw.slice(raw.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
const ids = ['X265', 'X273', 'DRBA', 'YY', 'YY1', 'YY2', 'WJ', 'YJ', 'GD'];
const eds = kepan.editions.filter((e) => ids.includes(e.id));

const cutLines = readFileSync(join(DATA, 'cuts.tsv'), 'utf8').trim().split('\n');
const head = cutLines[0].split('\t');
const cutRows = cutLines.slice(1).map((l) => l.split('\t'));
const ix = Object.fromEntries(head.map((h, i) => [h, i]));
const collapseAt = new Map(cutRows.map((r) => [+r[ix.old_u], r[ix.collapse] === '1']));
const exactAt = new Map(cutRows.map((r) => [+r[ix.old_u], +r[ix.exact_total] > 0]));

const nodes = [];
for (const ed of eds) for (const n of ed.nodes) {
  const collapse = collapseAt.get(n.u) || false;
  const exact = (ed.id === 'X265' || ed.id === 'DRBA') && exactAt.get(n.u);
  nodes.push({ u: n.u, collapse, exact, w: collapse ? 0 : exact ? 5 : 2 });
}
const cand = [...new Set(nodes.map((n) => n.u))].sort((a, b) => a - b);
const totalW = nodes.reduce((a, n) => a + n.w, 0);
const byCut = new Map();
for (const c of cand) byCut.set(c, nodes.map((n, i) => (Math.abs(n.u - c) <= K ? i : -1)).filter((i) => i >= 0));

const covered = new Uint8Array(nodes.length);
const selected: number[] = [];
const selectedSet = new Set<number>();
let got = 0;
while (got < totalW) {
  let best = null, bestGain = 0;
  for (const c of cand) {
    if (selectedSet.has(c)) continue;
    let gain = 0;
    for (const i of byCut.get(c)!) if (!covered[i]) gain += nodes[i].w;
    if (gain > bestGain) { bestGain = gain; best = c; }
  }
  if (best == null) break;
  selected.push(best);
  selectedSet.add(best);
  for (const i of byCut.get(best)!) if (!covered[i]) { covered[i] = 1; got += nodes[i].w; }
}

const selectedRows = cutRows.filter((r) => selectedSet.has(+r[ix.old_u]));
const out = [['rank', ...head].join('\t')];
selected.forEach((u, i) => {
  const r = cutRows.find((x) => +x[ix.old_u] === u);
  if (r) out.push([String(i + 1), ...r].join('\t'));
});
writeFileSync(join(DATA, 'cuts-coarse.tsv'), out.join('\n') + '\n');
writeFileSync(join(ROOT, 'build', 'cuts-coarse-summary.json'), JSON.stringify({ k: K, selected: selected.length, weightCovered: got / totalW, totalWeight: totalW }, null, 2) + '\n');
console.log(`k=${K} selected ${selected.length}; weight coverage ${(got / totalW).toFixed(4)}`);
console.log(out.slice(0, 3).join('\n'));
